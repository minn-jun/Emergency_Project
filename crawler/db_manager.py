import pymysql
import config

def get_connection():
    """DB 연결 객체 생성"""
    try:
        # config.py에 있는 설정값 사용
        conn = pymysql.connect(
            host=config.DB_CONFIG['host'],
            user=config.DB_CONFIG['user'],
            password=config.DB_CONFIG['password'],
            db=config.DB_CONFIG['db'],
            charset=config.DB_CONFIG['charset'],
            cursorclass=pymysql.cursors.DictCursor
        )
        return conn
    except Exception as e:
        print(f"DB 연결 실패: {e}")
        return None

def save_disaster_msg(data):
    """재난 문자 저장 및 오래된 데이터 정리"""
    conn = get_connection()
    if not conn:
        return

    try:
        with conn.cursor() as cursor:
            # 1. 데이터 삽입 (중복 시 무시 - INSERT IGNORE)
            sql = """
            INSERT IGNORE INTO disaster_msg 
            (msg_no, disaster_type, msg_type, send_loc, send_time, content)
            VALUES (%s, %s, %s, %s, %s, %s)
            """
            cursor.execute(sql, (
                data["msg_no"], data["disaster_type"], data["msg_type"],
                data["send_loc"], data["send_time"], data["content"]
            ))
            
            # 2. 데이터 정리 (최신 10개만 유지)
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
            
            if cursor.rowcount == 0:
                print(f"DB: 이미 존재하는 메시지 (Msg No: {data['msg_no']}) - 저장 건너뜀")
            else:
                print(f"DB: 신규 메시지 저장 완료 (Msg No: {data['msg_no']})")

    except Exception as e:
        print(f"DB 작업 오류: {e}")
        conn.rollback()
    finally:
        conn.close()