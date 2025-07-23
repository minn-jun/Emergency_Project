// disaster-alert.js - 재난 문자 자동 알림 기능

let lastMsgId = null;

function mapDisasterType(disaster_type) {
  const type = disaster_type.trim();
  if (type === '지진') return 'earthquake';
  if (['태풍', '홍수', '호우', '강풍', '풍랑'].includes(type)) return 'flood';
  if (type === '폭염') return 'heatwave';
  if (['한파', '대설'].includes(type)) return 'coldwave';
  if (['민방공', '공습', '테러', '화생방사고', '비상사태'].includes(type)) return 'attack';
  return null;
}

function processDisasterAlert(data) {
  console.log('새로운 재난 문자 처리 시작:', data);
  const { msg_no, disaster_type, send_loc, send_time, content } = data;

  const modal = document.getElementById('disasterAlertModal');
  const contentDiv = document.getElementById('disasterAlertContent');

  contentDiv.innerHTML = `
    <p><strong>재난 유형:</strong> ${disaster_type}</p>
    <p><strong>송출 지역:</strong> ${send_loc}</p>
    <p><strong>송출 시간:</strong> ${send_time}</p>
    <p class="content">${content}</p>
  `;
  modal.style.display = 'flex';

  const matchedType = mapDisasterType(disaster_type);
  if (matchedType) {
    const radio = document.querySelector(`input[name="disasterType"][value="${matchedType}"]`);
    if (radio && !radio.disabled) {
      radio.checked = true;

      const event = new Event('change', { bubbles: true });
      radio.dispatchEvent(event);
      console.log(`알림: 재난 유형이 '${matchedType}'(으)로 변경되었습니다.`);

      const wideAreaDisasters = ['earthquake', 'flood', 'attack'];
      if (wideAreaDisasters.includes(matchedType)) {
        const rangeSlider = document.getElementById('rangeSlider');
        const maxRange = parseInt(rangeSlider.max);

        window.currentRange = maxRange;
        rangeSlider.value = maxRange;
        document.getElementById('rangeValue').textContent = maxRange;

        console.log(`광역 재난(${matchedType}) 감지. 검색 범위를 최댓값(${maxRange}m)으로 자동 확장합니다.`);
      }

      if (isMapReady && typeof showRangeCircle === 'function' && typeof updateShelterDisplay === 'function') {
        showRangeCircle();
        updateShelterDisplay();
      } else {
        console.warn('지도 라이브러리가 아직 준비되지 않아, 지도 업데이트를 건너뜁니다.');
      }
    }
  } else {
    console.log(`알림: 재난 유형 '${disaster_type}'은(는) 지원되지 않습니다.`);
  }

  lastMsgId = msg_no;
}

// 서버에 최신 문자가 있는지 주기적으로 확인
async function checkForDisasterAlerts() {
  try {
    const response = await fetch('/api/get-latest-disaster');
    if (!response.ok) {
      throw new Error(`서버 응답 오류: ${response.status}}`);
    }
    const data = await response.json();

    if (data && data.msg_no !== lastMsgId) {
      processDisasterAlert(data);
    }
  } catch (error) {
    console.error('재난 문자 확인 중 오류:', error);
  }
}

// DOM 로드 시 자동 알림 기능 초기화
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('disasterAlertModal');

  modal.addEventListener('click', (e) => {
    if (e.target.id === 'disasterAlertCloseBtn' || e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // 1분 마다 새로운 재난 문자가 있는지 확인
  setInterval(checkForDisasterAlerts, 60000);
});
