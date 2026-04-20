import os
import tkinter as tk
from tkinter import filedialog, messagebox

def generate_cookie_string(cookie_file_path):
    """
    Lee un archivo de cookies en formato Netscape y genera una cadena de cookies
    en el formato: cookie: key1=value1; key2=value2; ...
    """
    cookie_string = "cookie: "
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

        # Unir las cookies con ; y añadir al prefijo
        cookie_string += "; ".join(cookies)
        return cookie_string

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
        title="Seleccionar archivo de cookies",
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

    # Generar la cadena de cookies
    result = generate_cookie_string(cookie_file_path)
    
    # Imprimir la cadena de cookies
    print(result)
    
    # Nombre del archivo de salida
    output_file = os.path.join(output_folder, "cookie_output.txt")
    
    # Guardar la cadena en un archivo
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result)
        messagebox.showinfo("Éxito", f"La cadena de cookies se ha guardado en {output_file}")
    except Exception as e:
        messagebox.showerror("Error", f"No se pudo guardar el archivo: {str(e)}")

    # Destruir la ventana principal
    root.destroy()

if __name__ == "__main__":
    main()