// map.js - 지도 기능 및 일반

// 전역 변수
let map;
let markers = [];
let shelterData = [];
let currentCenter = { lat: 37.5665, lng: 126.978 }; // 서울시청 기준
let currentRange = 200;
let rangeCircle;
let currentDisasterType = 'default'; // 현재 선택된 재난유형
let openedInfoWindow = null; // 열려있는 인포윈도우 추적
let searchLocationMarker = null;

// 지도 초기화
function initMap() {
  const mapContainer = document.getElementById('map');
  const mapOption = {
    center: new kakao.maps.LatLng(currentCenter.lat, currentCenter.lng),
    level: 3,
  };
  map = new kakao.maps.Map(mapContainer, mapOption);

  kakao.maps.event.addListener(map, 'click', () => {
    if (openedInfoWindow) openedInfoWindow.close();
  });

  loadShelterData(currentDisasterType);
  showRangeCircle();
}

// 대피소 데이터 로드
async function loadShelterData(type) {
  try {
    const response = await fetch(`/api/shelters?type=${type}`);
    if (!response.ok) throw new Error(`서버 응답 오류: ${response.status}`);
    shelterData = await response.json();
    // 현재 모드에 따라 화면 업데이트
    if (window.isSimulationMode) {
      updateShelterDisplay(); // 시뮬레이션 모드일 경우 대피소만 업데이트
    } else {
      updateShelterDisplay(); // 일반 모드 업데이트
    }
  } catch (error) {
    console.error('대피소 데이터 로드 실패:', error);
    shelterData = [];
    updateShelterDisplay();
  }
}

// 일반 모드: 범위 원 표시
function showRangeCircle() {
  if (rangeCircle) rangeCircle.setMap(null);
  rangeCircle = new kakao.maps.Circle({
    center: new kakao.maps.LatLng(currentCenter.lat, currentCenter.lng),
    radius: currentRange,
    strokeWeight: 2,
    strokeColor: '#667eea',
    strokeOpacity: 0.8,
    fillColor: '#667eea',
    fillOpacity: 0.1,
  });
  rangeCircle.setMap(map);
}

// 거리 계산 (미터)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 범위 내 대피소 필터링
function filterSheltersInRange() {
  if (!shelterData || shelterData.length === 0) return [];
  return shelterData.filter((shelter) => {
    const distance = calculateDistance(currentCenter.lat, currentCenter.lng, shelter.latitude, shelter.longitude);
    return distance <= currentRange;
  });
}

// 가장 가까운 대피소 찾기
function findClosestShelter() {
  if (!shelterData || shelterData.length === 0) return null;
  return shelterData.reduce(
    (closest, shelter) => {
      const distance = calculateDistance(currentCenter.lat, currentCenter.lng, shelter.latitude, shelter.longitude);
      if (distance < closest.minDistance) {
        return { shelter, minDistance: distance };
      }
      return closest;
    },
    { shelter: null, minDistance: Infinity }
  ).shelter;
}

// 모든 대피소 마커 제거
function clearShelterMarkers() {
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
}

// 대피소 마커 생성
function createShelterMarker(shelter, distance) {
  const position = new kakao.maps.LatLng(shelter.latitude, shelter.longitude);
  // 마커 zIndex 제거 (단순 마커에는 불필요)
  const marker = new kakao.maps.Marker({ position, map });

  // 인포윈도우 내용에서 '소요시간' 제거
  const infoContent = `
    <div class="infowindow-content">
      <h4 class="infowindow-title">${shelter.name}</h4>
      <p class="infowindow-address">${shelter.address}</p>
      <div class="infowindow-details">
        <span class="infowindow-tag type">${shelter.type}</span>
        <span class="infowindow-tag distance">거리: ${Math.round(distance)}m</span>
      </div>
    </div>
  `;

  const infoWindow = new kakao.maps.InfoWindow({
    content: infoContent,
    disableAutoPan: true,
    zIndex: 1,
  });

  kakao.maps.event.addListener(marker, 'click', () => {
    if (openedInfoWindow) openedInfoWindow.close();
    infoWindow.open(map, marker);
    openedInfoWindow = infoWindow;
  });

  markers.push(marker);
}

// 대피소 목록 업데이트
function updateShelterList(shelters) {
  const container = document.getElementById('shelterListContainer');
  container.innerHTML = '';

  if (!shelters || shelters.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#888;">주변에 대피소가 없습니다.</p>';
    return;
  }

  shelters.sort((a, b) => {
    const distA = calculateDistance(currentCenter.lat, currentCenter.lng, a.latitude, a.longitude);
    const distB = calculateDistance(currentCenter.lat, currentCenter.lng, b.latitude, b.longitude);
    return distA - distB;
  });

  shelters.forEach((shelter) => {
    const distance = calculateDistance(currentCenter.lat, currentCenter.lng, shelter.latitude, shelter.longitude);
    const shelterItem = document.createElement('div');
    shelterItem.className = 'shelter-item';
    shelterItem.innerHTML = `
      <div class="shelter-name">${shelter.name}</div>
      <div class="shelter-address">${shelter.address}</div>
      <div class="shelter-info">
        <span class="shelter-type">${shelter.type}</span>
        <span class="shelter-distance">거리: ${Math.round(distance)}m</span>
      </div>
    `;
    shelterItem.addEventListener('click', () => {
      map.setCenter(new kakao.maps.LatLng(shelter.latitude, shelter.longitude));
      map.setLevel(2);
    });
    container.appendChild(shelterItem);
  });
}

// 지도 위 모든 요소 초기화
function clearAllMapElements() {
  clearShelterMarkers();

  if (searchLocationMarker) searchLocationMarker.setMap(null);
  if (rangeCircle) rangeCircle.setMap(null);

  resetSimulationElements();
}

// 애플리캐이션 초기화
function resetApplicationState() {
  console.log('애플리케이션 상태 초기화');

  clearAllMapElements();

  currentCenter = { lat: 37.5665, lng: 126.978 };
  currentRange = 200;

  document.getElementById('rangeSlider').value = currentRange;
  document.getElementById('rangeValue').textContent = currentRange;
  updateShelterList([]);
  document.getElementById('shelterCount').textContent = 0;
  document.getElementById('locationInput').value = '';
  document.getElementById('startLocationInput').value = '';
  document.getElementById('disasterLocationInput').value = '';

  // 지도 초기화
  map.setCenter(new kakao.maps.LatLng(currentCenter.lat, currentCenter.lng));
  map.setLevel(3);
}

// 대피소 표시 업데이트
function updateShelterDisplay() {
  clearShelterMarkers();

  let sheltersToDisplay = filterSheltersInRange();

  // 시뮬레이션 모드가 아닐 때만 가장 가까운 대피소 찾기 로직 실행
  if (!window.isSimulationMode && sheltersToDisplay.length === 0) {
    const closestShelter = findClosestShelter();
    if (closestShelter) sheltersToDisplay = [closestShelter];
  }

  sheltersToDisplay.forEach((shelter) => {
    const distance = calculateDistance(currentCenter.lat, currentCenter.lng, shelter.latitude, shelter.longitude);
    createShelterMarker(shelter, distance);
  });

  updateShelterList(sheltersToDisplay);
  document.getElementById('shelterCount').textContent = sheltersToDisplay.length;
}

// 위치 검색 API 호출 (공용 함수)
async function searchLocationAPI(query) {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    return await response.json();
  } catch (error) {
    console.error('위치 검색 API 호출 실패: ', error);
    return [];
  }
}

// DOM 로드 후 실행
document.addEventListener('DOMContentLoaded', () => {
  if (typeof kakao !== 'undefined' && kakao.maps && kakao.maps.load) {
    kakao.maps.load(() => initMap());
  } else {
    console.error('카카오맵 API 로드 실패');
    document.getElementById('map').innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100%; background: #f5f5f5; color: #666;">
        <div style="text-align: center;">
          <h3>지도 로드 실패</h3>
          <p>카카오맵 API 키를 확인하거나, SDK가 정상 로드되었는지 확인하세요.</p>
          <p>브라우저 콘솔에서 오류 메시지를 확인해 주세요.</p>
        </div>
      </div>
    `;
  }

  // 재난 유형 변경
  document.getElementById('disasterTypeGroup').addEventListener('change', (e) => {
    currentDisasterType = e.target.value;
    loadShelterData(currentDisasterType);
  });

  // 일반 검색 버튼 및 엔터 키
  const locationInput = document.getElementById('locationInput');
  const searchBtn = document.getElementById('searchBtn');
  const searchResultsContainer = document.getElementById('searchResults');

  const performDefaultSearch = async () => {
    const query = locationInput.value.trim();
    if (!query) return;

    const results = await searchLocationAPI(query);
    searchResultsContainer.innerHTML = '';

    if (results.length > 0) {
      results.forEach((result) => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <div style="font-weight: 600;">${result.place_name}</div>
          <div style="color: #666; font-size: 0.9em;">${result.address_name}</div>
        `;
        item.addEventListener('click', () => {
          selectDefaultLocation(result);
          searchResultsContainer.style.display = 'none';
        });
        searchResultsContainer.appendChild(item);
      });
      searchResultsContainer.style.display = 'block';
    } else {
      searchResultsContainer.style.display = 'none';
    }
  };

  searchBtn.addEventListener('click', performDefaultSearch);
  locationInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performDefaultSearch();
  });

  // 일반 모드 위치 선택
  function selectDefaultLocation(location) {
    currentCenter = { lat: parseFloat(location.y), lng: parseFloat(location.x) };
    if (searchLocationMarker) searchLocationMarker.setMap(null);

    const imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png';
    const markerImage = new kakao.maps.MarkerImage(imageSrc, new kakao.maps.Size(36, 40), { offset: new kakao.maps.Point(15, 39) });
    const markerPosition = new kakao.maps.LatLng(currentCenter.lat, currentCenter.lng);

    searchLocationMarker = new kakao.maps.Marker({ position: markerPosition, image: markerImage });
    searchLocationMarker.setMap(map);

    map.setCenter(markerPosition);
    showRangeCircle();
    updateShelterDisplay();
    locationInput.value = location.place_name;
  }

  // 초기화 버튼
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (window.isSimulationMode) {
      resetApplicationState(); // 시뮬레이션 모드는 그냥 비운 상태로 둡니다.
    } else {
      resetApplicationState();
      showRangeCircle(); // 일반 모드는 기본 원과 대피소를 다시 보여줍니다.
      updateShelterDisplay();
    }
  });

  // 범위 슬라이더
  document.getElementById('rangeSlider').addEventListener('input', (e) => {
    currentRange = parseInt(e.target.value);
    document.getElementById('rangeValue').textContent = currentRange;

    if (!map) return;

    if (window.isSimulationMode) {
      drawSimulationCircles();
      updateShelterDisplay();
    } else {
      showRangeCircle();
      updateShelterDisplay();
    }
  });

  // 검색 결과 외부 클릭시 숨기기
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-section') && !e.target.closest('.simulation-inputs')) {
      document.getElementById('searchResults').style.display = 'none';
      document.getElementById('startSearchResults').style.display = 'none';
      document.getElementById('disasterSearchResults').style.display = 'none';
    }
  });

  const guideBtn = document.getElementById('guideBtn');
  const modal = document.getElementById('guideModal');
  const closeBtn = document.querySelector('.modal-close-btn');
  const guideImage = document.getElementById('guideImage');

  guideBtn.addEventListener('click', () => {
    const imagePath = `/images/${currentDisasterType}.png`;
    guideImage.src = imagePath;
    guideImage.onerror = () => {
      guideImage.src = '/images/default.png';
      console.error(`${imagePath} 이미지를 찾을 수 없습니다.`);
    };
    modal.style.display = 'flex';
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
});
