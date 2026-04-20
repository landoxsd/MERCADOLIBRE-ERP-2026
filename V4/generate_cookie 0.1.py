import os

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
    # Ruta del archivo de cookies
    cookie_file_path = "C:\Users\orlando\Documents\MANUS\V4\www.mercadolibre.com.ve_cookies.txt"
    
    # Generar la cadena de cookies
    result = generate_cookie_string(cookie_file_path)
    
    # Imprimir la cadena de cookies
    print(result)
    
    # Opcionalmente, guardar la cadena en un archivo
    output_file = "cookie_output.txt"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(result)
    print(f"\nLa cadena de cookies se ha guardado en {output_file}")

if __name__ == "__main__":
    main()