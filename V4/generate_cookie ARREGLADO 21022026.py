import os
import tkinter as tk
from tkinter import filedialog, messagebox
import json

def escape_cookie_value(value):
    """
    Escapa correctamente el valor de una cookie para que sea seguro incluirlo
    en una cadena de encabezado 'Cookie: ...'
    """
    # Método más seguro: usar json.dumps para escapar comillas, barras, etc.
    # json.dumps("texto con \"comillas\" y \n") → "\"texto con \\\"comillas\\\" y \\n\""
    escaped = json.dumps(value)[1:-1]  # Quitamos las comillas externas que añade json.dumps
    return escaped

def generate_cookie_string(cookie_file_path):
    """
    Lee un archivo de cookies en formato Netscape y genera una cadena válida:
    cookie: name1=value1; name2=value2; ...
    Maneja correctamente comillas, JSON y caracteres especiales.
    """
    cookies = []

    try:
        with open(cookie_file_path, 'r', encoding='utf-8') as file:
            for line in file:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue

                parts = line.split('\t')
                if len(parts) >= 7:
                    name = parts[5]
                    value = parts[6]
                    # Escapar el valor de forma segura
                    safe_value = escape_cookie_value(value)
                    cookies.append(f"{name}={safe_value}")

        if not cookies:
            return "Error: No se encontraron cookies válidas en el archivo."

        cookie_header = "cookie: " + "; ".join(cookies)
        return cookie_header

    except FileNotFoundError:
        return "Error: El archivo de cookies no se encontró."
    except Exception as e:
        return f"Error al procesar el archivo: {str(e)}"

def main():
    root = tk.Tk()
    root.withdraw()  # Ocultar ventana principal

    # Seleccionar archivo de cookies
    cookie_file_path = filedialog.askopenfilename(
        title="Seleccionar archivo de cookies (formato Netscape)",
        filetypes=[("Archivos de texto", "*.txt"), ("Todos los archivos", "*.*")]
    )

    if not cookie_file_path:
        messagebox.showwarning("Cancelado", "No se seleccionó ningún archivo.")
        return

    # Seleccionar carpeta de salida
    output_folder = filedialog.askdirectory(
        title="Seleccionar carpeta donde guardar la cookie"
    )

    if not output_folder:
        messagebox.showwarning("Cancelado", "No se seleccionó carpeta de salida.")
        return

    # Generar cookie
    result = generate_cookie_string(cookie_file_path)

    if result.startswith("Error") or result.startswith("cookie: ;"):
        messagebox.showerror("Error", result)
        return

    # Mostrar resultado en consola
    print("\n" + "="*60)
    print("CADENA DE COOKIE GENERADA CORRECTAMENTE")
    print("="*60)
    print(result)
    print("="*60)

    # Guardar en archivo
    output_file = os.path.join(output_folder, "cookie_mercadolibre.txt")
    
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result)
        
        messagebox.showinfo(
            "Éxito",
            f"Cookie generada y guardada correctamente!\n\nArchivo:\n{output_file}\n\n¡Ya puedes usarla en Postman, cURL o scripts!"
        )
    except Exception as e:
        messagebox.showerror("Error al guardar", f"No se pudo guardar el archivo:\n{str(e)}")

    root.destroy()

if __name__ == "__main__":
    main()