import csv
import pymysql

# ✅ DB 연결
conn = pymysql.connect(
    host='localhost',
    user='ming',
    password='1234',
    db='emergency',
    charset='utf8mb4'
)
cur = conn.cursor()

# ✅ CSV 파일 경로
csv_file = 'shelters/shelters_final.csv'

with open(csv_file, newline='', encoding='utf-8-sig') as file:
    reader = csv.DictReader(file)
    for row in reader:
        shelter_name = row['대피소명']
        address = row.get('주소', None)
        latitude = float(row['위도'])
        longitude = float(row['경도'])
        shelter_type_raw = row['유형']

        # 🚩 1️⃣ shelter 테이블에 삽입
        cur.execute("""
            INSERT INTO shelter (shelter_name, address, latitude, longitude)
            VALUES (%s, %s, %s, %s)
        """, (shelter_name, address, latitude, longitude))

        # 생성된 shelter_id 가져오기
        shelter_id = cur.lastrowid

        # 🚩 2️⃣ shelter_type 문자열 파싱 → 리스트로 변환
        # 예: "[무더위쉼터, 한파쉼터]" → ['무더위쉼터', '한파쉼터']
        types = shelter_type_raw.strip('[]').replace('"', '').replace("'", "").split(',')
        types = [t.strip() for t in types if t.strip()]

        # 🚩 3️⃣ shelter_type 테이블에 여러 유형 삽입
        for t in types:
            cur.execute("""
                INSERT INTO shelter_type (shelter_id, shelter_type)
                VALUES (%s, %s)
            """, (shelter_id, t))

# ✅ 커밋 및 종료
conn.commit()
conn.close()

print("✅ CSV 데이터가 shelter / shelter_type 테이블로 정상 분할·삽입 완료!")
