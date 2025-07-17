let map;
let markers = [];
let shelterData = [];
let currentCenter = { lat: 37.5665, lng: 126.978 }; // 서울시청 기준
let currentRange = 200;
let rangeCircle;
let currentDisasterType = 'default'    // 현재 선택된 재난유형

// 지도 초기화
function initMap() {
  try {
    console.log("지도 초기화 시작");
    const mapContainer = document.getElementById("map");
    const mapOption = {
      center: new kakao.maps.LatLng(currentCenter.lat, currentCenter.lng),
      level: 3,
    };

    map = new kakao.maps.Map(mapContainer, mapOption);
    console.log("지도 생성 완료");

    // 대피소 데이터 로드
    loadShelterData(currentDisasterType);

    // 초기 범위 표시
    showRangeCircle();

    console.log("지도 초기화 완료");
  } catch (error) {
    console.error("지도 초기화 실패:", error);
    document.getElementById("map").innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; background: #f5f5f5; color: #666;">
                <div style="text-align: center;">
                    <h3>지도 초기화 실패</h3>
                    <p>오류: ${error.message}</p>
                </div>
            </div>
        `;
  }
}

// 대피소 데이터 로드
async function loadShelterData(type) {
  try {
    console.log(`${type} 유형의 대피소 데이터를 로드합니다.`);
    const response = await fetch(`/api/shelters?type=${type}`);
    if (!response.ok) {
      throw new Error(`서버 응답 오류: ${response.status}`);
    }
    shelterData = await response.json();
    updateShelterDisplay();
  } catch (error) {
    console.error("대피소 데이터 로드 실패:", error);
    shelterData = [];           // 오류 발생 시 데이터 초기화
    updateShelterDisplay();     // 화면 갱신
  }
}

// 범위 원 표시
function showRangeCircle() {
  if (rangeCircle) {
    rangeCircle.setMap(null);
  }

  rangeCircle = new kakao.maps.Circle({
    center: new kakao.maps.LatLng(currentCenter.lat, currentCenter.lng),
    radius: currentRange,
    strokeWeight: 2,
    strokeColor: "#667eea",
    strokeOpacity: 0.8,
    fillColor: "#667eea",
    fillOpacity: 0.1,
  });

  rangeCircle.setMap(map);
}

// 두 지점 간 거리 계산 (미터)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // 지구 반지름 (미터)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// 범위 내 대피소 필터링
function filterSheltersInRange() {
  if (!shelterData || shelterData.length === 0) return [];
  return shelterData.filter((shelter) => {
    const distance = calculateDistance(
      currentCenter.lat,
      currentCenter.lng,
      shelter.latitude,
      shelter.longitude
    );
    return distance <= currentRange;
  });
}

// 마커 제거
function clearMarkers() {
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
}

// 마커 생성
function createMarker(shelter, distance) {
  const capacityText = shelter.capacity > 0 ? `${shelter.capacity}명` : '정보 없음';

  const position = new kakao.maps.LatLng(shelter.latitude, shelter.longitude);

  const marker = new kakao.maps.Marker({
    position: position,
    map: map,
  });

  // 인포윈도우 생성
  const infoContent = `
        <div style="padding: 10px; min-width: 200px;">
            <h4 style="margin-bottom: 5px;">${shelter.name}</h4>
            <p style="margin-bottom: 3px; color: #666;">${shelter.address}</p>
            <p style="margin-bottom: 3px;"><strong>유형:</strong> ${shelter.type}</p>
            <p style="margin-bottom: 3px;"><strong>수용인원:</strong> ${capacityText}명</p>
            <p style="color: #667eea;"><strong>거리:</strong> ${Math.round(distance)}m</p>
        </div>
    `;

  const infoWindow = new kakao.maps.InfoWindow({
    content: infoContent,
  });

  kakao.maps.event.addListener(marker, "click", () => {
    infoWindow.open(map, marker);
  });

  markers.push(marker);
}

// 대피소 목록 업데이트
function updateShelterList(shelters) {
  const container = document.getElementById("shelterListContainer");
  container.innerHTML = "";

  if (shelters.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#888;">주변에 대피소가 없습니다.</p>';
    return;
  }

  shelters.forEach((shelter) => {
    const capacityText = shelter.capacity > 0 ? `수용인원: ${shelter.capacity}명` : '수용인원: 정보 없음';

    const distance = calculateDistance(
      currentCenter.lat,
      currentCenter.lng,
      shelter.latitude,
      shelter.longitude
    );

    const shelterItem = document.createElement("div");
    shelterItem.className = "shelter-item";
    shelterItem.innerHTML = `
            <div class="shelter-name">${shelter.name}</div>
            <div class="shelter-address">${shelter.address}</div>
            <div class="shelter-info">
                <span class="shelter-type">${shelter.type}</span>
                <span class="shelter-capacity">수용인원: ${capacityText}명</span>
                <span class="shelter-distance">거리: ${Math.round(distance)}m</span>
            </div>
        `;

    // 클릭 시 해당 마커로 이동
    shelterItem.addEventListener("click", () => {
      const position = new kakao.maps.LatLng(
        shelter.latitude,
        shelter.longitude
      );
      map.setCenter(position);
      map.setLevel(2);
    });

    container.appendChild(shelterItem);
  });
}

// 대피소 표시 업데이트
function updateShelterDisplay() {
  clearMarkers();

  const sheltersInRange = filterSheltersInRange();

  sheltersInRange.forEach((shelter) => {
    const distance = calculateDistance(
      currentCenter.lat,
      currentCenter.lng,
      shelter.latitude,
      shelter.longitude
    );
    createMarker(shelter, distance);
  });

  updateShelterList(sheltersInRange);
  document.getElementById("shelterCount").textContent = sheltersInRange.length;
}

// 위치 검색
async function searchLocation(query) {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const results = await response.json();

    const resultsContainer = document.getElementById("searchResults");
    resultsContainer.innerHTML = "";

    if (results.length > 0) {
      results.forEach((result) => {
        const item = document.createElement("div");
        item.className = "search-result-item";
        item.innerHTML = `
                    <div style="font-weight: 600;">${result.place_name}</div>
                    <div style="color: #666; font-size: 0.9em;">${result.address_name}</div>
                `;

        item.addEventListener("click", () => {
          selectLocation(result);
          resultsContainer.style.display = "none";
        });

        resultsContainer.appendChild(item);
      });

      resultsContainer.style.display = "block";
    } else {
      resultsContainer.style.display = "none";
    }
  } catch (error) {
    console.error("위치 검색 실패:", error);
  }
}

// 위치 선택
function selectLocation(location) {
  currentCenter = {
    lat: parseFloat(location.y),
    lng: parseFloat(location.x),
  };

  // 지도 중심 이동
  map.setCenter(new kakao.maps.LatLng(currentCenter.lat, currentCenter.lng));

  // 범위 원 업데이트
  showRangeCircle();

  // 대피소 표시 업데이트
  updateShelterDisplay();

  // 입력창 내용 업데이트
  document.getElementById("locationInput").value = location.place_name;
}

// 이벤트 리스너 등록
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded 발생");

  if (typeof kakao !== "undefined" && kakao.maps && kakao.maps.load) {
    console.log("kakao.maps 객체 확인 완료");
    kakao.maps.load(() => {
      console.log("카카오맵 API 로드 완료, 지도 초기화 시작");
      initMap();
    });
  } else {
    console.error(
      "❌ kakao 객체가 존재하지 않습니다. SDK가 제대로 불러와졌는지 확인하세요."
    );
    document.getElementById("map").innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100%; background: #f5f5f5; color: #666;">
          <div style="text-align: center;">
              <h3>지도 로드 실패</h3>
              <p>카카오맵 API 키를 확인하거나, SDK가 정상 로드되었는지 확인하세요.</p>
              <p>브라우저 콘솔에서 오류 메시지를 확인해 주세요.</p>
          </div>
      </div>
    `;
  }

  // 재난 유형 변경 이벤트
  document.getElementById('disasterTypeGroup').addEventListener('change', (e) => {
    if (e.target.name === 'disasterType') {
        currentDisasterType = e.target.value;
        loadShelterData(currentDisasterType);
    }
  });

  // 검색 버튼
  document.getElementById("searchBtn").addEventListener("click", () => {
    const query = document.getElementById("locationInput").value.trim();
    if (query) {
      searchLocation(query);
    }
  });

  // 입력창 엔터키
  document.getElementById("locationInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const query = e.target.value.trim();
      if (query) {
        searchLocation(query);
      }
    }
  });

  // 범위 슬라이더
  document.getElementById("rangeSlider").addEventListener("input", (e) => {
    currentRange = parseInt(e.target.value);
    document.getElementById("rangeValue").textContent = currentRange;
    showRangeCircle();
    updateShelterDisplay();
  });

  // 검색 결과 외부 클릭시 숨기기
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-section")) {
      document.getElementById("searchResults").style.display = "none";
    }
  });
});
