from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
import json
import time
import requests
import pymysql # DB 모듈 임포트

# --- 셀레니움 설정 (기존과 동일) ---
options = Options()
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
service = Service(ChromeDriverManager().install())

# --- 서버 및 DB 설정 ---
SERVER_URL = "http://localhost:3000/api/disaster-update"

DB_CONFIG = {
    'host': 'localhost',
    'user': 'ming', # (DB 사용자)
    'password': '1234', # (DB 비밀번호)
    'db': 'emergency', # (DB 이름)
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

def db_connect():
    """DB 연결"""
    try:
        conn = pymysql.connect(**DB_CONFIG)
        print("DB 연결 성공")
        return conn
    except Exception as e:
        print(f"DB 연결 실패: {e}")
        return None

def save_to_db(data):
    """(요청 3) 크롤링한 데이터를 DB에 저장 (중복 시 무시)"""
    conn = db_connect()
    if not conn:
        return
        
    try:
        with conn.cursor() as cursor:
            # 1. 데이터 삽입 (PK 중복 시 무시)
            # [수정된 부분]
            sql = """
            INSERT IGNORE INTO disaster_msg (msg_no, disaster_type, msg_type, send_loc, send_time, content)
            VALUES (%s, %s, %s, %s, %s, %s)
            """
            # [기존 코드]
            # ON DUPLICATE KEY UPDATE
            #     disaster_type = VALUES(disaster_type),
            #     msg_type = VALUES(msg_type),
            #     send_loc = VALUES(send_loc),
            #     send_time = VALUES(send_time),
            #     content = VALUES(content)
            
            cursor.execute(sql, (
                data["msg_no"], data["disaster_type"], data["msg_type"],
                data["send_loc"], data["send_time"], data["content"]
            ))
            
            # ... (이하 10개 데이터 삭제 로직은 동일) ...
            sql_trim = """
            DELETE FROM disaster_msg
            WHERE msg_no NOT IN (
                SELECT msg_no FROM (
                    SELECT msg_no
                    FROM disaster_msg
                    ORDER BY created_at DESC, msg_no DESC
                    LIMIT 10
                ) AS temp
            )
            """
            cursor.execute(sql_trim)
            
            conn.commit()
            
            # cursor.rowcount가 0이면 "무시됨", 1이면 "삽입됨"
            if cursor.rowcount == 0:
                print(f"DB 저장 무시 (Msg No: {data['msg_no']} 이미 존재함)")
            else:
                print(f"DB 신규 저장 성공 (Msg No: {data['msg_no']})")

    except Exception as e:
        print(f"DB 작업 실패: {e}")
        conn.rollback()
    finally:
        conn.close()

def crawling_send_disaster_msg():
    driver = webdriver.Chrome(service=service, options=options)
    disaster_data = None # disaster_data 스코프 변경
    
    try:
        # --- (크롤링 로직: 기존과 동일) ---
        url = "https://www.safekorea.go.kr/idsiSFK/neo/sfk/cs/sfc/dis/disasterMsgList.jsp?menuSeq=679"
        driver.get(url)
        time.sleep(2)  

        # region_select = Select(driver.find_element(By.ID, "sbLawArea1"))
        # region_select.select_by_visible_text("서울특별시")
        # time.sleep(1)
        
        # search_button = driver.find_element(By.CLASS_NAME, "search_btn")
        # search_button.click()
        # time.sleep(3)

        rows = driver.find_elements(By.CSS_SELECTOR, ".boardList_table tbody tr")
        
        if not rows:
            print("재난 문자 데이터를 찾을 수 없습니다.")
            return
          
        latest_message_row = rows[0]
        cells = latest_message_row.find_elements(By.TAG_NAME, "td")
        
        if len(cells) >= 6:
            disaster_data = {
                "msg_no": cells[0].text.strip(),
                "disaster_type": cells[1].text.strip(),
                "msg_type": cells[2].text.strip(),
                "send_loc": cells[3].text.strip(),
                "send_time": cells[4].text.strip(),
                "content": cells[5].text.strip()
            }
        
        print("재난 문자 크롤링 성공")
        print(json.dumps(disaster_data, ensure_ascii=False, indent=2))
        
    except Exception as e:
        print("크롤링 오류 발생:", e)
    finally:
        driver.quit()

    # 크롤링 성공 시 DB 저장 및 서버 알림
    if disaster_data:
        # (요청 3) DB에 저장
        save_to_db(disaster_data)
        
        # (요청 4) 실시간 알림을 위해 서버에 POST (기존 로직 유지)
        try:
            headers = {'Content-Type': 'application/json'}
            response = requests.post(SERVER_URL, data=json.dumps(disaster_data), headers=headers, timeout=5)
            if response.status_code == 200:
                print(f"서버로 데이터 전송 성공 (상태 코드: {response.status_code})")
            else:
                print(f"서버로 데이터 전송 실패 (상태 코드: {response.status_code})")
        except requests.exceptions.RequestException as e:
            print(f"서버 연결 오류: {e}")
            
if __name__ == "__main__":
    while True:
        crawling_send_disaster_msg()
        print("\n... 1분 후 다음 크롤링 시작 ...\n")
        time.sleep(60)