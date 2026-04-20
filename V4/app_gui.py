# app_gui.py
# (Versión con búsqueda en tablas y optimización notas BD)

from flask import Flask, render_template, request, redirect, url_for, jsonify, flash
import threading
import time
import os
import json
import webbrowser
from datetime import datetime, timedelta, timezone
import urllib.parse
import requests
import sqlite3 # Para operaciones directas en BD desde las rutas API de notas

# Importar la clase y la constante del plazo desde el core
# *** ASUME que se usa ml_sales_monitor_core_v2.py ***
from ml_sales_monitor_core import MercadoLibreMonitorCore, FEEDBACK_DEADLINE_DAYS

# --- Configuración de Flask ---
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev_secret_key_solo_para_pruebas_cambiar")

# --- Instancia Global del Monitor ---
monitor = MercadoLibreMonitorCore()

# --- Hilo para el Monitor ---
monitor_thread = None
monitor_thread_started = False
def run_monitor_in_background(): monitor.run()

# --- Rutas de Flask ---

@app.route('/')
def dashboard():
    """Muestra el panel principal."""
    status = monitor.get_status()
    # Obtener órdenes recientes (sin búsqueda para el dashboard)
    recent_orders = monitor.get_orders_from_db(limit=10)
    recent_logs = monitor.get_log_lines(num_lines=15)
    return render_template('dashboard.html',
                           status=status,
                           orders=recent_orders,
                           logs=recent_logs)

@app.route('/control/start')
def start_monitor():
    """Inicia el hilo del monitor."""
    global monitor_thread
    if not monitor.running:
        if monitor_thread is None or not monitor_thread.is_alive():
            app.logger.info("Iniciando hilo del monitor...")
            monitor_thread = threading.Thread(target=run_monitor_in_background, name="MonitorThread", daemon=True)
            monitor_thread.start()
            flash("Monitor iniciado.", "success"); time.sleep(1) # Pausa breve para que estado cambie
        else:
            flash("Hilo ya existe pero el monitor indica detenido. Intenta detener primero.", "warning")
            app.logger.warning("Intento de inicio con hilo vivo pero monitor.running es False.")
    else:
        flash("Monitor ya en ejecución.", "warning")
    return redirect(url_for('dashboard'))

@app.route('/control/stop')
def stop_monitor():
    """Detiene el monitor."""
    if monitor.running:
        app.logger.info("Solicitando detener monitor...")
        monitor.stop()
        flash("Monitor detenido.", "success")
        time.sleep(1) # Opcional: esperar un poco para que el estado se actualice
    else:
        flash("Monitor ya estaba detenido.", "info")
    return redirect(url_for('dashboard'))

@app.route('/config', methods=['GET', 'POST'])
def configure():
    """Muestra y permite editar la configuración de cuentas."""
    if request.method == 'POST':
        accounts_json = request.form.get('accounts_json')
        if not accounts_json:
            flash("No se recibieron datos de configuración.", "danger")
            return redirect(url_for('configure'))
        try:
            data_from_form = json.loads(accounts_json)
            if isinstance(data_from_form, list): new_accounts_list = data_from_form
            elif isinstance(data_from_form, dict) and 'accounts' in data_from_form: new_accounts_list = data_from_form['accounts']
            else: raise ValueError("El JSON debe ser una lista de cuentas o un objeto con la clave 'accounts'.")

            success, message = monitor.update_configuration(new_accounts_list)
            if success: flash(message, "success")
            else: flash(f"Error guardando configuración: {message}", "danger")
        except json.JSONDecodeError: flash("Error: El formato del JSON es inválido.", "danger")
        except ValueError as ve: flash(f"Error en los datos de configuración: {ve}", "danger")
        except Exception as e: flash(f"Error inesperado al guardar configuración: {e}", "danger"); app.logger.error(f"Error guardando configuración: {e}", exc_info=True)
        return redirect(url_for('configure'))

    # Método GET
    current_config_with_status = monitor.get_configuration()
    config_accounts_list = [{k: v for k, v in acc.items() if k not in ['has_token', 'has_refresh_token', 'token_valid', 'token_expires']}
                           for acc in current_config_with_status]
    current_config_json = json.dumps(config_accounts_list, indent=2, ensure_ascii=False)
    return render_template('config.html', config_json=current_config_json, accounts_status=current_config_with_status)

@app.route('/auth/initiate/<nickname>')
def initiate_auth(nickname):
    """Inicia el flujo OAuth para una cuenta específica."""
    success, auth_url = monitor.initiate_oauth_flow(nickname)
    if success: flash(f"Se abrió una nueva pestaña para autorizar '{nickname}'. Después de autorizar, copia el parámetro 'code' de la URL.", "info")
    else: flash(f"No se pudo abrir el navegador automáticamente. Por favor, copia y pega esta URL para autorizar '{nickname}': {auth_url}", "warning")
    return redirect(url_for('configure'))

@app.route('/auth/complete', methods=['POST'])
def complete_auth():
    """Recibe el código de autorización y lo intercambia por tokens."""
    nickname = request.form.get('nickname'); auth_code = request.form.get('auth_code')
    if not nickname or not auth_code: flash("Falta seleccionar la cuenta o pegar el código de autorización.", "danger"); return redirect(url_for('configure'))
    success, message = monitor.exchange_code_for_token(nickname, auth_code.strip())
    if success: flash(f"Autenticación completada exitosamente para '{nickname}'.", "success")
    else: flash(f"Error durante la autenticación para '{nickname}': {message}", "danger")
    return redirect(url_for('configure'))

@app.route('/logs')
def view_logs():
    """Muestra más líneas de log."""
    all_logs = monitor.get_log_lines(num_lines=200)
    return render_template('logs.html', logs=all_logs)

# *** MODIFICADO para aceptar búsqueda ***
@app.route('/data/<data_type>', methods=['GET', 'POST'])
def view_data(data_type):
    """Muestra tablas (con búsqueda) y maneja actualización de teléfono manual."""
    search_term = request.args.get('search', '') # Obtener término de búsqueda de la URL

    if request.method == 'POST' and data_type == 'clients':
        client_id = request.form.get('client_id'); manual_phone = request.form.get('manual_phone')
        if not client_id: flash("Falta ID de cliente para actualizar teléfono.", "danger")
        else:
            success, message = monitor.update_manual_phone(client_id, manual_phone)
            if success: flash(message, "success")
            else: flash(f"Error actualizando teléfono: {message}", "danger")
        # Redirigir manteniendo el término de búsqueda si existe
        redirect_url = url_for('view_data', data_type='clients')
        if search_term:
            redirect_url += f"?search={urllib.parse.quote_plus(search_term)}"
        return redirect(redirect_url)

    # Método GET (o POST no relacionado con actualización de teléfono)
    items = []; title = "Datos"; columns = []; template_file = 'data_view.html'
    if data_type == 'orders':
        # Pasar el término de búsqueda a la función del core
        items = monitor.get_orders_from_db(limit=100, search_term=search_term)
        title = "Todas las Órdenes (Básico - Últimas 100)"
        columns = [('ORDEN_ID', 'ID Orden'), ('Seller_Nickname', 'Vendedor'), ('nickname', 'Nickname Comprador'), ('scraped_name', 'Nombre Scrapeado'), ('scraped_phone', 'Teléfono Scrapeado'), ('Fecha_Creacion', 'Fecha Creación'), ('status', 'Estado API')]
    elif data_type == 'clients':
        # Pasar el término de búsqueda a la función del core
        items = monitor.get_clients_from_db(limit=100, search_term=search_term)
        title = "Clientes (Últimos 100)"
        columns = [('id_cliente', 'ID Cliente'), ('Nome_Cliente', 'Nombre Cliente'), ('Nickname', 'Nickname'), ('Telefono', 'Teléfono (Scraping)'), ('telefono_manual', 'Teléfono (Manual)')]
    else:
        flash("Tipo de dato no válido.", "warning");
        return redirect(url_for('dashboard'))

    # Pasar el término de búsqueda a la plantilla para mostrarlo en el input
    return render_template(template_file, items=items, title=title, columns=columns, data_type=data_type, search_term=search_term)


# --- Ruta /open_orders (OPTIMIZADA para leer notas de BD local y con búsqueda) ---
# *** MODIFICADO para aceptar búsqueda ***
@app.route('/open_orders')
def view_open_orders():
    """Muestra la tabla detallada de órdenes (con búsqueda y notas locales)."""
    start_time_render = time.time()
    search_term = request.args.get('search', '') # Obtener término de búsqueda
    app.logger.info(f"[view_open_orders] Iniciando carga... {'Buscando: ' + search_term if search_term else ''}")

    # Pasar el término de búsqueda a la función del core
    raw_orders = monitor.get_open_orders_detailed(limit=50, search_term=search_term)
    processed_orders = []
    site_id = "MLV"; now_utc = datetime.now(timezone.utc)
    monitor._load_config()
    account_logos_map = {acc.get('nickname'): acc.get('logo_file') for acc in monitor.accounts if acc.get('nickname') and acc.get('logo_file')}
    app.logger.debug(f"Mapa de logos: {account_logos_map}")

    all_notes_dict = {}
    order_ids_to_show = [str(o['ORDEN_ID']) for o in raw_orders if o.get('ORDEN_ID')]
    if order_ids_to_show:
        conn_notes = monitor._connect_db()
        if conn_notes:
            try:
                conn_notes.row_factory = sqlite3.Row; cursor = conn_notes.cursor()
                placeholders = ','.join('?' * len(order_ids_to_show))
                sql_notes = f"SELECT orden_id, nota_id_ml, texto_nota FROM ORDEN_NOTAS WHERE orden_id IN ({placeholders}) ORDER BY ultima_actualizacion_local DESC"
                cursor.execute(sql_notes, order_ids_to_show)
                for row in cursor.fetchall():
                    current_order_id_str = str(row['orden_id'])
                    if current_order_id_str not in all_notes_dict: all_notes_dict[current_order_id_str] = []
                    all_notes_dict[current_order_id_str].append({"id": row["nota_id_ml"], "note": row["texto_nota"]})
                app.logger.info(f"[view_open_orders] Notas locales cargadas para {len(all_notes_dict)} órdenes.")
            except Exception as e_notes_db: app.logger.error(f"Error cargando notas locales: {e_notes_db}", exc_info=True)
            finally: monitor._close_db(conn_notes)
        else: app.logger.error("[view_open_orders] No DB conn para notas locales.")

    for order_data in raw_orders:
        processed = dict(order_data); order_id_current_str = str(order_data.get('ORDEN_ID'))
        processed['items'] = []; processed['sale_link'] = f"https://www.mercadolibre.com.ve/ventas/{order_id_current_str}/detalle"
        processed['whatsapp_link'] = None; processed['creation_dt'] = None; processed['feedback_deadline'] = None; processed['feedback_remaining_str'] = "N/A"
        processed['notes'] = all_notes_dict.get(order_id_current_str, []) # Asignar notas locales
        seller_nickname = order_data.get('Seller_Nickname'); processed['account_logo_file'] = account_logos_map.get(seller_nickname)

        json_lk_str = order_data.get('JSON_LK')
        if json_lk_str:
             try:
                 details = json.loads(json_lk_str)
                 for item in details.get('order_items', []):
                      item_data = item.get('item', {}); item_id_original = item_data.get('id'); pub_link = None
                      if item_id_original and isinstance(item_id_original, str): item_id_digits = item_id_original.replace(site_id, "").replace("-",""); formatted_item_id = f"{site_id}-{item_id_digits}"; pub_link = f"https://articulo.mercadolibre.com.ve/{formatted_item_id}"
                      processed['items'].append({'title': item_data.get('title', 'N/A'), 'quantity': item.get('quantity', 0), 'unit_price': item.get('unit_price', 0.0), 'currency_id': item.get('currency_id', ''), 'sku': item_data.get('seller_sku', 'N/A'), 'item_id': item_id_original, 'publication_link': pub_link })
             except Exception as e: app.logger.error(f"Error JSON items orden {order_id_current_str}: {e}")

        fecha_str = order_data.get('Fecha_Creacion')
        if fecha_str:
             try:
                 # Intenta manejar diferentes formatos ISO 8601
                 if '.' in fecha_str: # Formato con microsegundos
                     fecha_str_clean = fecha_str.split('.')[0]
                 else: # Formato sin microsegundos
                     fecha_str_clean = fecha_str.replace('Z', '')
                 # Asegurar que termina con zona horaria UTC
                 if not fecha_str.endswith('Z') and '+' not in fecha_str_clean and '-' not in fecha_str_clean[10:]: # Evitar confundir con guiones en fecha
                      fecha_str_clean += '+00:00'
                 else:
                      fecha_str_clean = fecha_str.replace('Z', '+00:00')

                 creation_dt_utc = datetime.fromisoformat(fecha_str_clean)
                 # Si no tiene timezone, asumimos UTC
                 if creation_dt_utc.tzinfo is None:
                     creation_dt_utc = creation_dt_utc.replace(tzinfo=timezone.utc)

                 processed['creation_dt'] = creation_dt_utc
                 deadline_dt = creation_dt_utc + timedelta(days=FEEDBACK_DEADLINE_DAYS)
                 processed['feedback_deadline'] = deadline_dt
                 time_diff = deadline_dt - now_utc
                 if time_diff.total_seconds() > 0:
                     days=time_diff.days; hours,rem=divmod(time_diff.seconds,3600); minutes,_=divmod(rem,60)
                     processed['feedback_remaining_str'] = f"{days}d {hours}h {minutes}m"
                 else:
                     processed['feedback_remaining_str'] = "Plazo Vencido"
             except Exception as e_date:
                 app.logger.error(f"Error parseando fecha o calculando tiempo para orden {order_id_current_str} (Fecha: '{fecha_str}'): {e_date}")
                 processed['feedback_remaining_str'] = "Error Fecha"
        else:
             processed['feedback_remaining_str'] = "Sin Fecha"


        manual_phone = order_data.get('telefono_manual'); scraped_phone = order_data.get('scraped_phone'); phone_to_use = manual_phone if manual_phone else scraped_phone
        if phone_to_use:
             phone_digits = ''.join(filter(str.isdigit, phone_to_use))
             if len(phone_digits) >= 10:
                  if not phone_digits.startswith('58') and len(phone_digits) <= 11:
                       if phone_digits.startswith('0'): phone_digits = phone_digits[1:]
                       if len(phone_digits) == 10: phone_digits = '58' + phone_digits
                  if phone_digits.startswith('58') and len(phone_digits) == 12: processed['whatsapp_link'] = f"https://wa.me/{phone_digits}"

        processed_orders.append(processed)

    end_time_render = time.time()
    app.logger.info(f"[view_open_orders] Renderizado completo en {end_time_render - start_time_render:.2f} seg.")
    # Pasar el término de búsqueda a la plantilla
    return render_template('open_orders.html', orders=processed_orders, search_term=search_term)

# *** MODIFICADO busqueda manuel de telefono fuerza el scraping ***
@app.route('/debug/scrape_order/<order_id>', methods=['GET'])
def debug_scrape_order(order_id):
    """Ruta de depuración para forzar el scraping de una orden específica."""
    if not order_id:
        flash("ID de orden no proporcionado.", "danger")
        return redirect(url_for('dashboard'))

    # Conectar a la base de datos para obtener la cuenta asociada
    conn = monitor._connect_db()
    if not conn:
        flash("Error de conexión a la base de datos.", "danger")
        return redirect(url_for('dashboard'))

    try:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT Seller_Nickname FROM ORDENES_ABIERTAS WHERE ORDEN_ID = ?", (order_id,))
        result = cursor.fetchone()
        if not result:
            flash(f"No se encontró la orden {order_id} en la base de datos.", "warning")
            return redirect(url_for('dashboard'))
        seller_nickname = result['Seller_Nickname']
    except Exception as e:
        flash(f"Error al consultar la base de datos: {e}", "danger")
        return redirect(url_for('dashboard'))
    finally:
        monitor._close_db(conn)

    # Obtener la configuración de la cuenta
    account = next((acc for acc in monitor.accounts if acc['nickname'] == seller_nickname), None)
    if not account:
        flash(f"No se encontró la configuración para la cuenta {seller_nickname}.", "danger")
        return redirect(url_for('dashboard'))

    # Obtener el token de acceso
    access_token = monitor.get_valid_access_token_for_account(seller_nickname)
    if not access_token:
        flash(f"No se pudo obtener un token válido para la cuenta {seller_nickname}.", "danger")
        return redirect(url_for('dashboard'))

    # Obtener los detalles de la orden
    order_details = monitor.get_order_details(order_id, access_token)
    if not order_details:
        flash(f"No se pudieron obtener los detalles de la orden {order_id}.", "danger")
        return redirect(url_for('dashboard'))

    # Forzar el procesamiento de la orden (incluye scraping)
    success = monitor.process_order(order_details, seller_nickname, account.get('cookie'), access_token)
    if success:
        flash(f"Orden {order_id} procesada exitosamente. Revisa los logs para verificar el scraping.", "success")
    else:
        flash(f"Error al procesar la orden {order_id}.", "danger")

    return redirect(url_for('view_open_orders'))

# --- API update_manual_phone ---
@app.route('/api/update_manual_phone', methods=['POST'])
def api_update_manual_phone():
    client_id = request.form.get('client_id')
    manual_phone = request.form.get('manual_phone')
    search_term_from_form = request.form.get('search_term_hidden', '') # Obtener de campo oculto si se añade

    if not client_id:
        flash("Falta ID cliente para actualizar teléfono.", "danger")
        # Redirigir de vuelta con el término de búsqueda si es posible
        redirect_url = url_for('view_open_orders')
        if search_term_from_form: # O request.args.get('search') si se pasó en la URL de acción
            redirect_url += f"?search={urllib.parse.quote_plus(search_term_from_form)}"
        return redirect(redirect_url)

    success, message = monitor.update_manual_phone(client_id, manual_phone)
    flash(message, "success" if success else "danger")

    # Redirigir de vuelta a open_orders
    # El search_term para la redirección debe venir del formulario o de la URL original
    # Si el 'action' del form ya incluye search_term, request.args.get('search') funcionará
    # Si no, necesitamos pasarlo explícitamente.
    
    # Para obtener el search_term de la URL a la que se hizo POST (si se incluyó en el action)
    search_term_from_action_url = request.args.get('search', '')

    final_search_term = search_term_from_form or search_term_from_action_url

    redirect_url = url_for('view_open_orders')
    if final_search_term:
        redirect_url += f"?search={urllib.parse.quote_plus(final_search_term)}"
    
    return redirect(redirect_url)

# --- Ruta WhatsApp ---
@app.route('/whatsapp/qualify/<order_id>')
def request_qualification(order_id):
    if not order_id: flash("ID orden inválido.", "danger"); return redirect(url_for('view_open_orders'))
    conn = monitor._connect_db(); order_info = None
    product_name = "tu compra" # Valor por defecto
    if conn:
        try:
            conn.row_factory = sqlite3.Row; cursor = conn.cursor()
            cursor.execute("""
                SELECT o.ORDEN_ID, o.Seller_Nickname, o.nickname AS buyer_nickname,
                       o.scraped_name AS buyer_scraped_name, c.Nome_Cliente AS client_db_name,
                       c.telefono_manual, o.scraped_phone,
                       o.JSON_LK
                FROM ORDENES_ABIERTAS o
                LEFT JOIN CLIENTES c ON o.userID = c.id_cliente
                WHERE o.ORDEN_ID = ?
            """, (order_id,))
            order_info = cursor.fetchone()

            if order_info and order_info['JSON_LK']:
                try:
                    order_details_json = json.loads(order_info['JSON_LK'])
                    if order_details_json.get('order_items'):
                        first_item = order_details_json['order_items'][0].get('item', {})
                        product_name = first_item.get('title', "tu producto")
                except (json.JSONDecodeError, IndexError): # Capturar ambos errores
                    app.logger.error(f"Error procesando JSON_LK para orden {order_id} en request_qualification", exc_info=True)
        except Exception as e: app.logger.error(f"Error buscando datos WA orden {order_id}: {e}")
        finally: monitor._close_db(conn)
    if not order_info: flash(f"No datos para orden {order_id}.", "danger"); return redirect(url_for('view_open_orders'))
    buyer_name_to_use = order_info['buyer_scraped_name'] or \
                        order_info['client_db_name'] or \
                        order_info['buyer_nickname'] or \
                        "Cliente"
    manual_phone = order_info['telefono_manual']; scraped_phone = order_info['scraped_phone']; phone_to_use = manual_phone if manual_phone else scraped_phone
    whatsapp_link_base = None
    if phone_to_use:
        phone_digits = ''.join(filter(str.isdigit, phone_to_use))
        if len(phone_digits) >= 10:
            if not phone_digits.startswith('58') and len(phone_digits) <= 11:
                 if phone_digits.startswith('0'): phone_digits = phone_digits[1:]
                 if len(phone_digits) == 10: phone_digits = '58' + phone_digits
            if phone_digits.startswith('58') and len(phone_digits) == 12: whatsapp_link_base = f"https://wa.me/{phone_digits}"
    if not whatsapp_link_base: flash(f"No tel válido WA para orden {order_id}.", "warning"); return redirect(url_for('view_open_orders'))
    buyer_nickname = order_info['buyer_nickname'] or "Cliente"; seller_nickname = order_info['Seller_Nickname'] or "nosotros"
    qualification_link = f"https://feedback.mercadolibre.com.ve/feedback?orderId={order_id}"
    message = (f"¡Hola {buyer_name_to_use}! 😊 Te escribimos de parte de {seller_nickname} sobre tu compra en MercadoLibre ({product_name} - Orden: {order_id}).\n\n"
               f"¿Podrías por favor dejarnos tu calificación sobre la experiencia? \nTu opinión es muy importante.\n\n"
               f"Puedes hacerlo aquí:\n{qualification_link}\n\n¡Gracias!")

    encoded_message = urllib.parse.quote(message); final_url = f"{whatsapp_link_base}?text={encoded_message}"
    app.logger.info(f"Redirigiendo a WA orden {order_id}: {final_url}"); return redirect(final_url)

# --- Ruta Status API ---
@app.route('/status_api')
def status_api():
    return jsonify(monitor.get_status())

# --- FUNCIONES AUXILIARES PARA NOTAS ---

def _get_account_and_token_for_order(order_id):
    """Busca orden en BD local, determina nickname y obtiene token válido."""
    conn = None
    try:
        conn = monitor._connect_db()
        if not conn: app.logger.error(f"[_get_acct_token] No DB conn."); return None
        cursor = conn.cursor(); cursor.execute("SELECT Seller_Nickname FROM ORDENES_ABIERTAS WHERE ORDEN_ID = ?", (order_id,))
        result = cursor.fetchone()
        if result and result[0]:
            seller_nickname = result[0]; app.logger.debug(f"[_get_acct_token] Orden {order_id} -> {seller_nickname}")
            access_token = monitor.get_valid_access_token_for_account(seller_nickname)
            if access_token: app.logger.debug(f"[_get_acct_token] Token OK para {seller_nickname}"); return {"nickname": seller_nickname, "access_token": access_token}
            else: app.logger.error(f"[_get_acct_token] No token para {seller_nickname}"); return None
        else: app.logger.warning(f"[_get_acct_token] No se encontró orden {order_id}"); return None
    except Exception as e: app.logger.error(f"Error en _get_acct_token {order_id}: {e}", exc_info=True); return None
    finally:
        if conn: monitor._close_db(conn)

# --- RUTAS API PARA NOTAS (Interactúan con API ML y BD Local) ---

@app.route('/api/orders/<int:order_id>/notes', methods=['POST'])
def add_order_note(order_id):
    """Endpoint API para añadir nota (API ML + BD Local)."""
    try: data = request.get_json(); note_text = data.get('note_text')
    except: return jsonify({"error":"JSON Inválido"}), 400
    if not note_text or len(note_text)>300: return jsonify({"error":"Texto nota inválido"}),400

    account_info = _get_account_and_token_for_order(order_id)
    if not account_info or 'access_token' not in account_info: return jsonify({"error":"No auth"}), 500
    access_token = account_info['access_token']

    ml_api_url = f"https://api.mercadolibre.com/orders/{order_id}/notes"
    headers = {'Authorization': f'Bearer {access_token}', 'Content-Type':'application/json', 'Accept':'application/json'}
    payload = { "note": note_text }

    try:
        response = requests.post(ml_api_url, headers=headers, json=payload, timeout=15)
        app.logger.info(f"[add_order_note] ML API POST Status {order_id}: {response.status_code}")
        response_data = None
        try: response_data = response.json()
        except: response_text = response.text; app.logger.warning(f"Respuesta ML add_note no JSON {order_id} Status={response.status_code}")

        if response.ok:
            app.logger.info(f"[add_order_note] Éxito API ML {order_id}.")
            # --- GUARDAR LOCAL ---
            new_note_id_ml = None; new_note_text_resp = note_text
            if isinstance(response_data, dict): new_note_id_ml = response_data.get('id'); new_note_text_resp = response_data.get('note', note_text)

            if new_note_id_ml:
                app.logger.info(f"[add_order_note] Intentando guardar localmente nota ID: {new_note_id_ml} para orden {order_id}") # LOG AÑADIDO
                monitor._save_notes_to_db(order_id, [{"id": new_note_id_ml, "note": new_note_text_resp}]) # Usa método del core
                app.logger.info(f"[add_order_note] Llamada a _save_notes_to_db completada para nota ID: {new_note_id_ml}") # LOG AÑADIDO
            else: app.logger.error(f"[add_order_note] No ID en resp ML, no guardado local {order_id}.")
            # --- FIN GUARDAR LOCAL ---
            return jsonify(response_data if response_data else {"success": True}), response.status_code
        else:
            error_message = f"Error API ML ({response.status_code})";
            if response_data and isinstance(response_data, dict): error_message = response_data.get('message', error_message)
            elif not response_data: error_message = f"{error_message}: {response_text[:200]}"
            app.logger.error(f"[add_order_note] Error al añadir nota {order_id}. Msj: {error_message}")
            return jsonify({"error": error_message}), response.status_code
    except requests.exceptions.Timeout: app.logger.error(f"Timeout ML add_note {order_id}"); return jsonify({"error": "Timeout ML"}), 504
    except requests.exceptions.RequestException as e: app.logger.error(f"Error red ML add_note {order_id}: {e}"); return jsonify({"error": f"Error red: {e}"}), 503
    except Exception as e: app.logger.error(f"Error inesperado add_note {order_id}: {e}", exc_info=True); return jsonify({"error": f"Error interno: {e}"}), 500


@app.route('/api/orders/<int:order_id>/notes/<string:note_id>', methods=['DELETE'])
def delete_order_note(order_id, note_id):
    """Endpoint API para eliminar nota (API ML + BD Local)."""
    app.logger.info(f"[delete_order_note] Eliminando nota {note_id} orden {order_id}...")
    account_info = _get_account_and_token_for_order(order_id)
    if not account_info or 'access_token' not in account_info: return jsonify({"error":"No auth"}), 500
    access_token = account_info['access_token']

    ml_api_url = f"https://api.mercadolibre.com/orders/{order_id}/notes/{note_id}"
    headers = {'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'}

    try:
        response = requests.delete(ml_api_url, headers=headers, timeout=15)
        app.logger.info(f"[delete_order_note] ML API DELETE Status {order_id}/{note_id}: {response.status_code}")

        if response.ok or response.status_code == 204:
            app.logger.info(f"[delete_order_note] Éxito API ML {order_id}/{note_id}.")
            # BORRAR LOCAL
            conn_del = monitor._connect_db()
            if conn_del:
                try:
                    cursor = conn_del.cursor(); cursor.execute("DELETE FROM ORDEN_NOTAS WHERE nota_id_ml = ? AND orden_id = ?", (note_id, str(order_id)))
                    conn_del.commit()
                    if cursor.rowcount>0: app.logger.info(f"Nota {note_id} eliminada de BD local.")
                    else: app.logger.warning(f"Nota {note_id} no encontrada en BD local para orden {order_id}.")
                except Exception as e_db: app.logger.error(f"Error borrando nota local {note_id}: {e_db}"); conn_del.rollback()
                finally: monitor._close_db(conn_del)
            else: app.logger.error("No se pudo conectar a BD para borrar nota local.")
            return jsonify({"success": True}), 200
        else:
            error_message = f"Error API ML ({response.status_code})";
            try: response_data = response.json(); error_message = response_data.get('message', error_message)
            except: response_text = response.text; error_message = f"{error_message}: {response_text[:200]}"
            app.logger.error(f"[delete_order_note] Error al eliminar nota {order_id}/{note_id}. Msj: {error_message}")
            return jsonify({"error": error_message}), response.status_code
    except requests.exceptions.Timeout: app.logger.error(f"Timeout ML delete_note {order_id}/{note_id}"); return jsonify({"error": "Timeout ML"}), 504
    except requests.exceptions.RequestException as e: app.logger.error(f"Error red ML delete_note {order_id}/{note_id}: {e}"); return jsonify({"error": f"Error red: {e}"}), 503
    except Exception as e: app.logger.error(f"Error inesperado delete_note {order_id}/{note_id}: {e}", exc_info=True); return jsonify({"error": f"Error interno: {e}"}), 500


@app.route('/api/orders/<int:order_id>/notes/<string:note_id>', methods=['PUT'])
def update_order_note(order_id, note_id):
    """Endpoint API para modificar nota (API ML + BD Local)."""
    try: data = request.get_json(); note_text = data.get('note_text')
    except: return jsonify({"error":"JSON Inválido"}), 400
    if note_text is None or len(note_text)>300: return jsonify({"error":"Texto nota inválido"}),400

    app.logger.info(f"[update_order_note] Modificando nota {note_id} orden {order_id}...")
    account_info = _get_account_and_token_for_order(order_id)
    if not account_info or 'access_token' not in account_info: return jsonify({"error":"No auth"}), 500
    access_token = account_info['access_token']

    ml_api_url = f"https://api.mercadolibre.com/orders/{order_id}/notes/{note_id}"
    headers = {'Authorization': f'Bearer {access_token}', 'Content-Type':'application/json', 'Accept':'application/json'}
    payload = { "note": note_text }

    try:
        response = requests.put(ml_api_url, headers=headers, json=payload, timeout=15)
        app.logger.info(f"[update_order_note] ML API PUT Status {order_id}/{note_id}: {response.status_code}")
        response_data = None
        try: response_data = response.json()
        except: response_text = response.text; app.logger.warning("Respuesta ML update_note no JSON...")

        if response.ok:
            app.logger.info(f"[update_order_note] Éxito API ML {order_id}/{note_id}.")
             # ACTUALIZAR LOCAL
            conn_upd = monitor._connect_db()
            if conn_upd:
                 try:
                      cursor = conn_upd.cursor(); now_iso = datetime.now(timezone.utc).isoformat()
                      cursor.execute("UPDATE ORDEN_NOTAS SET texto_nota = ?, ultima_actualizacion_local = ? WHERE nota_id_ml = ? AND orden_id = ?",
                                     (note_text, now_iso, note_id, str(order_id)))
                      conn_upd.commit()
                      if cursor.rowcount>0: app.logger.info(f"Nota {note_id} actualizada en BD local.")
                      else: app.logger.warning(f"Nota {note_id} no encontrada en BD local para orden {order_id} para actualizar.")
                 except Exception as e_db: app.logger.error(f"Error actualizando nota local {note_id}: {e_db}"); conn_upd.rollback()
                 finally: monitor._close_db(conn_upd)
            else: app.logger.error("No se pudo conectar a BD para actualizar nota local.")
            return jsonify(response_data if response_data else {"success": True}), response.status_code
        else:
            error_message = f"Error API ML ({response.status_code})";
            if response_data and isinstance(response_data, dict): error_message = response_data.get('message', error_message)
            elif not response_data: error_message = f"{error_message}: {response_text[:200]}"
            app.logger.error(f"[update_order_note] Error al modificar nota {order_id}/{note_id}. Msj: {error_message}")
            return jsonify({"error": error_message}), response.status_code
    except requests.exceptions.Timeout: app.logger.error(f"Timeout ML update_note {order_id}/{note_id}"); return jsonify({"error": "Timeout ML"}), 504
    except requests.exceptions.RequestException as e: app.logger.error(f"Error red ML update_note {order_id}/{note_id}: {e}"); return jsonify({"error": f"Error red: {e}"}), 503
    except Exception as e: app.logger.error(f"Error inesperado update_note {order_id}/{note_id}: {e}", exc_info=True); return jsonify({"error": f"Error interno: {e}"}), 500

@app.route('/force_scrape_order/<order_id>', methods=['GET'])
def force_scrape_order(order_id):
    """Fuerza el scraping de una orden específica y actualiza los datos."""
    if not order_id:
        flash("ID de orden no proporcionado.", "danger")
        return redirect(url_for('view_open_orders'))

    conn = monitor._connect_db()
    if not conn:
        flash("Error de conexión a la base de datos.", "danger")
        return redirect(url_for('view_open_orders'))

    try:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT Seller_Nickname FROM ORDENES_ABIERTAS WHERE ORDEN_ID = ?", (order_id,))
        result = cursor.fetchone()
        if not result:
            flash(f"No se encontró la orden {order_id} en la base de datos.", "warning")
            return redirect(url_for('view_open_orders'))
        seller_nickname = result['Seller_Nickname']
    except Exception as e:
        flash(f"Error al consultar la base de datos: {e}", "danger")
        return redirect(url_for('view_open_orders'))
    finally:
        monitor._close_db(conn)

    account = next((acc for acc in monitor.accounts if acc['nickname'] == seller_nickname), None)
    if not account:
        flash(f"No se encontró la configuración para la cuenta {seller_nickname}.", "danger")
        return redirect(url_for('view_open_orders'))

    access_token = monitor.get_valid_access_token_for_account(seller_nickname)
    if not access_token:
        flash(f"No se pudo obtener un token válido para la cuenta {seller_nickname}.", "danger")
        return redirect(url_for('view_open_orders'))

    order_details = monitor.get_order_details(order_id, access_token)
    if not order_details:
        flash(f"No se pudieron obtener los detalles de la orden {order_id}.", "danger")
        return redirect(url_for('view_open_orders'))

    success = monitor.process_order(order_details, seller_nickname, account.get('cookie'), access_token, force_scraping=True)
    if success:
        flash(f"Scraping forzado exitoso para la orden {order_id}.", "success")
    else:
        flash(f"Error al forzar el scraping para la orden {order_id}.", "danger")

    return redirect(url_for('view_open_orders'))


# --- Ejecución Principal ---
if __name__ == '__main__':
    print("*"*60); print("Iniciando Aplicación Flask..."); print("Accede a: http://127.0.0.1:5000/"); print("*"*60)
    # Asegurarse de crear el directorio de plantillas si no existe
    if not os.path.exists('templates'):
        os.makedirs('templates')
        print("Directorio 'templates' creado.")
    # Crear archivos de plantilla básicos si no existen
    required_templates = ['layout.html', 'dashboard.html', 'config.html', 'logs.html', 'data_view.html', 'open_orders.html']
    for tmpl in required_templates:
        path = os.path.join('templates', tmpl)
        if not os.path.exists(path):
            with open(path, 'w') as f:
                f.write(f'\n{{% block body %}}{{% endblock %}}') # Contenido mínimo
            print(f"Archivo de plantilla '{tmpl}' creado.")

    if not monitor_thread_started:
         print("Iniciando monitor en segundo plano..."); monitor_thread = threading.Thread(target=run_monitor_in_background, name="MonitorThread", daemon=True); monitor_thread.start()
         monitor_thread_started = True; time.sleep(1)
    else: print("Hilo monitor ya iniciado (reloader?).")
    # Ejecutar Flask (asegúrate de que debug=False y use_reloader=False para producción)
    # Para desarrollo, puedes usar debug=True, use_reloader=True
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=True) # Cambiado para desarrollo
    print("\nSaliendo...");
    if monitor and monitor.running:
         print("Intentando detener el monitor...")
         monitor.stop()
         if monitor_thread and monitor_thread.is_alive():
              print("Esperando a que el hilo del monitor termine...")
              monitor_thread.join(timeout=5.0)
              if monitor_thread.is_alive(): print("Advertencia: Hilo monitor no terminó.")
    print("¡Hasta pronto!")


