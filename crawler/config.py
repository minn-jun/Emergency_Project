# DB 연결 설정
DB_CONFIG = {
    'host': 'localhost',       # 도커 사용 시 'mysql-container' 등으로 변경
    'user': 'ming',            # 또는 'ming'
    'password': '1234', # [!] 비밀번호 입력
    'db': 'emergency',
    'charset': 'utf8mb4',
    'cursorclass': 'pymysql.cursors.DictCursor'
}

# Node.js 서버 주소
SERVER_URL = "http://localhost:3000/api/disaster-update"