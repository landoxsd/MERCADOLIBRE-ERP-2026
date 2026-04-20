import os
import tkinter as tk
from tkinter import filedialog, messagebox
import json # Importar el módulo json para escapar la cadena

def generate_cookie_string(cookie_file_path):
    """
    Lee un archivo de cookies en formato Netscape, genera una cadena de cookies
    (key1=value1; key2=value2; ...) y luego la escapa para ser usada en JSON.
    """
    
    # 1. Generar la cadena de cookies en formato estándar
    cookie_string_raw = ""
    cookies = []

    try:
        with open(cookie_file_path, 'r', encoding='utf-8') as file:
            for line in file:
                # Ignorar líneas vacías o comentarios
                if line.strip() and not line.startswith('#'):
                    # Dividir la línea en columnas (formato Netscape: dominio, flag, path, secure, expiry, name, value)
                    parts = line.strip().split('\t')
                    if len(parts) >= 7:  # Asegurarse de que la línea tiene el formato correcto
                        name = parts[5]  # Nombre de la cookie
                        value = parts[6]  # Valor de la cookie
                        cookies.append(f"{name}={value}")

        # Unir las cookies con ; 
        # NOTA: Quité el prefijo "cookie: " porque no forma parte del valor JSON, 
        # sino que es un encabezado HTTP o parte de tu proceso.
        # Si lo necesitas, puedes añadirlo de nuevo, pero el valor de la clave 'cookie' en tu JSON es solo la cadena.
        cookie_string_raw = "; ".join(cookies)

        # 2. Escapar la cadena para uso en JSON
        # Usamos json.dumps() para asegurar que todas las comillas dobles,
        # barras invertidas, y otros caracteres especiales se escapen correctamente.
        # Luego quitamos las comillas externas que añade json.dumps()
        # ya que la cadena se va a colocar dentro de las comillas de la estructura JSON.
        
        # Ejemplo: si cookie_string_raw es 'a=1; b={"key":"val"}', 
        # json.dumps() la convierte en '"a=1; b={\\"key\\":\\"val\\"}"'
        # Luego quitamos las comillas de los extremos.
        
        json_escaped_string = json.dumps(cookie_string_raw)
        
        # Eliminamos las comillas dobles en los extremos
        # y añadimos el prefijo "cookie: " si es necesario, escapando solo el valor.
        # Retorno solo el valor escapado:
        return json_escaped_string[1:-1]

    except FileNotFoundError:
        return "Error: El archivo de cookies no se encontró."
    except Exception as e:
        return f"Error al procesar el archivo de cookies: {str(e)}"

def main():
    # Crear la ventana principal (oculta)
    root = tk.Tk()
    root.withdraw()  # Ocultar la ventana principal

    # Diálogo para seleccionar el archivo de cookies
    cookie_file_path = filedialog.askopenfilename(
        title="Seleccionar archivo de cookies (Netscape format)",
        filetypes=[("Archivos de texto", "*.txt"), ("Todos los archivos", "*.*")]
    )

    if not cookie_file_path:
        messagebox.showerror("Error", "No se seleccionó ningún archivo de cookies.")
        return

    # Diálogo para seleccionar la carpeta de salida
    output_folder = filedialog.askdirectory(
        title="Seleccionar carpeta para guardar el archivo de salida"
    )

    if not output_folder:
        messagebox.showerror("Error", "No se seleccionó ninguna carpeta de salida.")
        return

    # Generar la cadena de cookies escapada para JSON
    result = generate_cookie_string(cookie_file_path)
    
    if result.startswith("Error:"):
        messagebox.showerror("Error", result)
        return
        
    # Imprimir la cadena de cookies (escapada)
    print("--- Cadena de Cookie Escapada (Lista para JSON) ---")
    print(result)
    print("-----------------------------------------------------")
    
    # Nombre del archivo de salida
    output_file = os.path.join(output_folder, "cookie_output_escaped.txt")
    
    # Guardar la cadena en un archivo
    try:
        # Nota: Escribimos el resultado tal cual, sin el prefijo "cookie: "
        # para que se pueda copiar directamente como valor de la clave "cookie" en el JSON.
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result)
        messagebox.showinfo("Éxito", f"La cadena de cookies escapada para JSON se ha guardado en {output_file}\n\nCopie el contenido y péguelo como valor de la clave 'cookie' en su archivo de configuración JSON.")
    except Exception as e:
        messagebox.showerror("Error", f"No se pudo guardar el archivo: {str(e)}")

    # Destruir la ventana principal
    root.destroy()

if __name__ == "__main__":
    main()