import imaplib
import json
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

EMAIL = "hakon_zeng@163.com"
AUTH_CODE = "PKdEeYdnDKQbsUAd"
IMAP_SERVER = "imap.163.com"

def decode_mime_header(header_str):
    """解码MIME编码的邮件头"""
    if not header_str:
        return ""
    import base64
    result = []
    for match in re.finditer(r'=\?([^?]+)\?([BQ])\?([^?]+)\?=', header_str):
        charset, encoding, text = match.groups()
        if encoding.upper() == 'B':
            decoded = base64.b64decode(text).decode(charset, errors='ignore')
        else:
            import quopri
            decoded = quopri.decodestring(text.encode()).decode(charset, errors='ignore')
        result.append(decoded)
    if result:
        return ''.join(result)
    return header_str

def fetch_emails(limit=20):
    """拉取邮件列表"""
    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, 993)
        
        # 发送ID标识（163要求）
        tag = mail._new_tag().decode()
        mail.send(f'{tag} ID ("name" "HAKON-FrostMate" "version" "1.0")\r\n'.encode())
        while True:
            line = mail.readline()
            if line.decode().startswith(tag):
                break
        
        mail.login(EMAIL, AUTH_CODE)
        mail.select('INBOX')
        
        status, messages = mail.search(None, 'ALL')
        msg_ids = messages[0].split()
        
        emails = []
        for i in msg_ids[-limit:][::-1]:
            status, data = mail.fetch(i, '(BODY[HEADER.FIELDS (SUBJECT FROM DATE)])')
            if status == 'OK':
                raw = data[0][1].decode('utf-8', errors='ignore')
                subject = ""
                from_name = ""
                from_addr = ""
                date = ""
                
                for line in raw.strip().split('\n'):
                    if line.lower().startswith('subject:'):
                        subject = decode_mime_header(line[8:].strip())
                    elif line.lower().startswith('from:'):
                        from_str = line[5:].strip()
                        match = re.search(r'<([^>]+)>', from_str)
                        from_addr = match.group(1) if match else from_str
                        from_name = decode_mime_header(re.sub(r'<[^>]+>', '', from_str).strip())
                    elif line.lower().startswith('date:'):
                        date = line[5:].strip()
                
                emails.append({
                    "id": i.decode(),
                    "subject": subject or "(无主题)",
                    "fromName": from_name or from_addr,
                    "from": from_addr,
                    "date": date,
                    "preview": "",
                })
        
        mail.logout()
        return {"success": True, "emails": emails}
    except Exception as e:
        return {"success": False, "error": str(e)}

class EmailHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        parsed = urlparse(self.path)
        
        if parsed.path == '/emails':
            result = fetch_emails()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        pass  # 静默日志

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 5000), EmailHandler)
    print("Email API server running on http://localhost:5000")
    server.serve_forever()
