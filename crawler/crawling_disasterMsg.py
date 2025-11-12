# crawling_disasterMsg.py
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
import json
import time
import requests

# [모듈 임포트] 분리한 파일들 가져오기
import config
import db_manager

# 셀레니움 드라이버 설정
options = Options()
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
# 로그 불필요한 출력 숨기기 (선택사항)
options.add_argument("--log-level=3") 

service = Service(ChromeDriverManager().install())

def crawling_send_disaster_msg():
    driver = webdriver.Chrome(service=service, options=options)
    disaster_data = None
    
    try:
        # 1. 크롤링 시작
        url = "https://www.safekorea.go.kr/idsiSFK/neo/sfk/cs/sfc/dis/disasterMsgList.jsp?menuSeq=679"
        driver.get(url)
        time.sleep(2)

        # (필요 시 주석 해제) 지역 선택 로직
        # region_select = Select(driver.find_element(By.ID, "sbLawArea1"))
        # region_select.select_by_visible_text("서울특별시")
        # time.sleep(1)
        # search_button = driver.find_element(By.CLASS_NAME, "search_btn")
        # search_button.click()
        # time.sleep(3)

        # 데이터 추출
        rows = driver.find_elements(By.CSS_SELECTOR, ".boardList_table tbody tr")
        if not rows:
            print("데이터 없음")
            return
        
        cells = rows[0].find_elements(By.TAG_NAME, "td")
        if len(cells) >= 6:
            disaster_data = {
                "msg_no": cells[0].text.strip(),
                "disaster_type": cells[1].text.strip(),
                "msg_type": cells[2].text.strip(),
                "send_loc": cells[3].text.strip(),
                "send_time": cells[4].text.strip(),
                "content": cells[5].text.strip()
            }
            
            print(f"\n[크롤링 성공] {disaster_data['send_time']} / {disaster_data['send_loc']}")
            
    except Exception as e:
        print("크롤링 에러:", e)
    finally:
        driver.quit()

    # 2. 데이터 처리 (DB 저장 & 서버 전송)
    if disaster_data:
        # [DB 저장] db_manager에게 위임
        db_manager.save_disaster_msg(disaster_data)
        
        # [서버 전송] Node.js로 알림
        try:
            headers = {'Content-Type': 'application/json'}
            # config에 있는 주소 사용
            response = requests.post(config.SERVER_URL, data=json.dumps(disaster_data), headers=headers, timeout=5)
            if response.status_code == 200:
                print("Node 서버 전송: 성공")
            else:
                print(f"Node 서버 전송: 실패 ({response.status_code})")
        except Exception as e:
            print(f"Node 서버 연결 불가: {e}")

if __name__ == "__main__":
    print("=== 재난 문자 크롤러 시작 (Ctrl+C로 종료) ===")
    while True:
        crawling_send_disaster_msg()
        print("... 1분 대기 중 ...")
        time.sleep(60)