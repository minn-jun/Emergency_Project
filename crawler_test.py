from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
import json
import time

# 셀레니움 드라이버 설정
options = Options()
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")

# 크롬 드라이버 경로 설정
service = Service("C:/chromedriver/chromedriver.exe")  # ← 본인 시스템에 맞게 수정
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
    time.sleep(3)  # 페이지 로딩 대기 (검색 결과가 나타날 때까지)

    # 테이블에서 행(tr) 가져오기
    rows = driver.find_elements(By.CSS_SELECTOR, ".boardList_table tbody tr")
    
    disaster_data = []
    
    if not rows:
        print("❌ 재난 문자 데이터를 찾을 수 없습니다.")
    else:
        print("📢 최근 재난 문자 1건\n")
        for row in rows[:1]:  # ✅ 상위 1개만
            cells = row.find_elements(By.TAG_NAME, "td")
            if len(cells) >= 6:
                msg_no = cells[0].text.strip()
                disaster_type = cells[1].text.strip()
                msg_type = cells[2].text.strip()
                send_loc = cells[3].text.strip()
                send_time = cells[4].text.strip()
                content = cells[5].text.strip()
                
                disaster_data.append({
                  "msg_no": msg_no,
                  "disaster_type": disaster_type,
                  "msg_type": msg_type,
                  "send_loc": send_loc,
                  "send_time": send_time,
                  "content": content
                })
    
    # json 형태로 출력
    json_ouput = json.dumps(disaster_data, ensure_ascii=False, indent=2)
    print(json_ouput)

except Exception as e:
    print("오류 발생:", e)
finally:
    driver.quit()