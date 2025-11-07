from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
import json
import time
import requests

# 셀레니움 드라이버 설정
options = Options()
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")

# 크롬 드라이버 자동 설치
service = Service(ChromeDriverManager().install())

SERVER_URL = "http://localhost:3000/api/disaster-update"

def crawling_send_disaster_msg():
  driver = webdriver.Chrome(service=service, options=options)
  try:
    # 국민재난안전포털 재난 문자 페이지 접속
    url = "https://www.safekorea.go.kr/idsiSFK/neo/sfk/cs/sfc/dis/disasterMsgList.jsp?menuSeq=679"
    driver.get(url)
    time.sleep(2)  # JS 데이터 로딩 대기

    region_select = Select(driver.find_element(By.ID, "sbLawArea1"))
    region_select.select_by_visible_text("서울특별시")
    time.sleep(1)  # 변경 후 테이블 재로딩 시간 대기
    
    search_button = driver.find_element(By.CLASS_NAME, "search_btn")
    search_button.click()
    time.sleep(3)  # 페이지 로딩 대기

    # 테이블에서 행(tr) 가져오기
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
    
    try:
        headers = {'Content-Type': 'application/json'}
        response = requests.post(SERVER_URL, data=json.dumps(disaster_data), headers=headers, timeout=5)
        if response.status_code == 200:
            print(f"서버로 데이터 전송 성공 (상태 코드: {response.status_code})")
        else:
            print(f"서버로 데이터 전송 실패 (상태 코드: {response.status_code})")
    except requests.exceptions.RequestException as e:
        print(f"서버 연결 오류: {e}")

  except Exception as e:
      print("오류 발생:", e)
  finally:
      driver.quit()
      
if __name__ == "__main__":
    while True:
        crawling_send_disaster_msg()
        print("\n... 1분 후 다음 크롤링 시작 ...\n")
        time.sleep(60)