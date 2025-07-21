// simulation.js - 시뮬레이션 모드

window.isSimulationMode = false;
let startLocationMarker = null; // 현재 위치 마커 (빨강)
let disasterLocationMarker = null; // 재난 위치 마커 (보라)
let startLocationCircle = null; // 현재 위치 반경 원 (1km, 파랑)
let disasterLocationCircle = null; // 재난 위치 반경 원 (2km, 빨강)

// 시뮬레이션 관련 지도 요소 초기화
function resetSimulationElements() {
  if (startLocationMarker) startLocationMarker.setMap(null);
  if (disasterLocationMarker) disasterLocationMarker.setMap(null);
  if (startLocationCircle) startLocationCircle.setMap(null);
  if (disasterLocationCircle) disasterLocationCircle.setMap(null);

  startLocationMarker = null;
  disasterLocationMarker = null;
  startLocationCircle = null;
  disasterLocationCircle = null;
}

// 시뮬레이션용 원 그리기
function drawSimulationCircles() {
  // 기존 원 제거
  if (startLocationCircle) startLocationCircle.setMap(null);
  if (disasterLocationCircle) disasterLocationCircle.setMap(null);

  // 현재 위치 기준 원 (1km, 파란색)
  if (startLocationMarker) {
    startLocationCircle = new kakao.maps.Circle({
      center: startLocationMarker.getPosition(),
      radius: currentRange,
      strokeWeight: 2,
      strokeColor: '#007BFF', // 파란색
      strokeOpacity: 0.8,
      fillColor: '#007BFF',
      fillOpacity: 0.1,
    });
    startLocationCircle.setMap(map);
  }

  // 재난 위치 기준 원 (2km, 붉은색)
  if (disasterLocationMarker) {
    disasterLocationCircle = new kakao.maps.Circle({
      center: disasterLocationMarker.getPosition(),
      radius: 2000, // 2km
      strokeWeight: 2,
      strokeColor: '#DC3545', // 붉은색
      strokeOpacity: 0.8,
      fillColor: '#DC3545',
      fillOpacity: 0.15,
    });
    disasterLocationCircle.setMap(map);
  }
}

// 시뮬레이션 위치 선택 처리
function selectSimulationLocation(location, type) {
  const position = new kakao.maps.LatLng(parseFloat(location.y), parseFloat(location.x));
  let markerImage;

  if (type === 'start') {
    currentCenter = { lat: position.getLat(), lng: position.getLng() }; // 대피소 검색 기준점 변경
    if (startLocationMarker) startLocationMarker.setMap(null);

    const imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png';
    markerImage = new kakao.maps.MarkerImage(imageSrc, new kakao.maps.Size(36, 40), { offset: new kakao.maps.Point(15, 39) });
    startLocationMarker = new kakao.maps.Marker({ position, image: markerImage, zIndex: 10 });
    startLocationMarker.setMap(map);

    document.getElementById('startLocationInput').value = location.place_name;
    map.setCenter(position);
    updateShelterDisplay(); // '현재 위치'가 바뀌었으므로 대피소 목록 갱신
  } else {
    // 'disaster'
    if (disasterLocationMarker) disasterLocationMarker.setMap(null);

    const imageSrc = 'http://maps.google.com/mapfiles/ms/icons/purple-dot.png';
    markerImage = new kakao.maps.MarkerImage(imageSrc, new kakao.maps.Size(40, 40), { offset: new kakao.maps.Point(16, 32), zIndex: 10 });
    disasterLocationMarker = new kakao.maps.Marker({ position, image: markerImage });
    disasterLocationMarker.setMap(map);

    document.getElementById('disasterLocationInput').value = location.place_name;
  }
  drawSimulationCircles(); // 위치가 선택/변경될 때마다 원을 다시 그림
}

// DOM 로드 후 시뮬레이션 관련 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', () => {
  const simulationToggle = document.getElementById('simulationToggle');
  const simInputs = document.getElementById('simulationInputs');
  const defaultSearch = document.getElementById('defaultSearchSection');

  const defaultInput = document.getElementById('locationInput');
  const defaultBtn = document.getElementById('searchBtn');
  const rangeSlider = document.getElementById('rangeSlider');

  // 모드 전환
  simulationToggle.addEventListener('change', (e) => {
    // 전환 전 초기화
    resetApplicationState();

    window.isSimulationMode = e.target.checked;

    if (window.isSimulationMode) {
      simInputs.style.display = 'block';
      defaultSearch.style.display = 'none';
      defaultInput.disabled = true;
      defaultBtn.disabled = true;
    } else {
      simInputs.style.display = 'none';
      defaultSearch.style.display = 'block';
      defaultInput.disabled = false;
      defaultBtn.disabled = false;

      showRangeCircle();
      updateShelterDisplay();
    }
  });

  // 시뮬레이션용 검색창 처리
  async function handleSimulationSearch(query, type) {
    if (!query) return;

    const resultsContainerId = type === 'start' ? 'startSearchResults' : 'disasterSearchResults';
    const resultsContainer = document.getElementById(resultsContainerId);

    const results = await searchLocationAPI(query);
    resultsContainer.innerHTML = '';

    if (results.length > 0) {
      results.forEach((result) => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `<div style="font-weight: 600;">${result.place_name}</div><div style="color: #666; font-size: 0.9em;">${result.address_name}</div>`;
        item.addEventListener('click', () => {
          selectSimulationLocation(result, type);
          resultsContainer.style.display = 'none';
        });
        resultsContainer.appendChild(item);
      });
      resultsContainer.style.display = 'block';
    } else {
      resultsContainer.style.display = 'none';
    }
  }

  // 현재 위치 검색
  const startInput = document.getElementById('startLocationInput');
  const startBtn = document.getElementById('startSearchBtn');
  startBtn.addEventListener('click', () => handleSimulationSearch(startInput.value.trim(), 'start'));
  startInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSimulationSearch(startInput.value.trim(), 'start');
  });

  // 재난 위치 검색
  const disasterInput = document.getElementById('disasterLocationInput');
  const disasterBtn = document.getElementById('disasterSearchBtn');
  disasterBtn.addEventListener('click', () => handleSimulationSearch(disasterInput.value.trim(), 'disaster'));
  disasterInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSimulationSearch(disasterInput.value.trim(), 'disaster');
  });
});
