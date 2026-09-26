#!/usr/bin/env python3
import http.server, socketserver, webbrowser, socket, os
from pathlib import Path

os.chdir(Path(__file__).resolve().parent.parent)

def local_ip():
    try:
        s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
        s.connect(("8.8.8.8",80)); ip=s.getsockname()[0]; s.close(); return ip
    except Exception:
        return None

class ReuseTCPServer(socketserver.TCPServer):
    allow_reuse_address=True

port=8080
while port<8090:
    try:
        httpd=ReuseTCPServer(("0.0.0.0",port),http.server.SimpleHTTPRequestHandler)
        break
    except OSError:
        port+=1
else:
    raise SystemExit("No se encontró un puerto libre entre 8080 y 8089")

url=f"http://localhost:{port}"
print("\nDr.Coach! listo")
print(f"Mac:    {url}")
ip=local_ip()
if ip: print(f"Tablet en la misma Wi‑Fi: http://{ip}:{port}")
print("\nMantén esta ventana abierta mientras uses Dr.Coach!. Ctrl+C para cerrar.\n")
try: webbrowser.open(url)
except Exception: pass
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    httpd.server_close()
