document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('addForm');
  const listContainer = document.getElementById('shelterListContainer');
  const logoutBtn = document.getElementById('logoutBtn');

  // (요청 2) 검색 UI 요소
  const searchInput = document.getElementById('searchInput');
  const typeSearch = document.getElementById('typeSearch');
  const searchBtn = document.getElementById('searchBtn');

  // (요청 1) 페이지네이션 UI 요소
  const paginationContainer = document.getElementById('paginationContainer');
  const totalCountSpan = document.getElementById('totalCount');

  // 현재 상태
  let currentPage = 1;
  let currentSearch = '';
  let currentType = '';

  // (요청 1, 2) 대피소 불러오기 (페이지네이션, 검색 적용)
  async function loadShelters(page = 1, search = '', type = '') {
    currentPage = page;
    currentSearch = search;
    currentType = type;

    try {
      // API에 쿼리 파라미터로 전송
      const response = await fetch(`/api/admin/shelters?page=${page}&search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}`);

      if (response.status === 403) return (window.location.href = '/admin-login');
      if (!response.ok) throw new Error('데이터 로드 실패');

      const data = await response.json();
      const { shelters, totalPages, totalItems } = data;

      listContainer.innerHTML = '';
      if (shelters.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="5" style="text-align: center;">데이터가 없습니다.</td></tr>';
      }

      shelters.forEach((s) => {
        const row = document.createElement('tr');

        // (요청) 주소가 null이면 빈칸으로
        const displayAddress = s.address || '';

        // [추가] 타입이 null이면 (GROUP_CONCAT 결과가 null) '미지정' 표시
        const displayType = s.shelter_type || '미지정';

        row.innerHTML = `
            <td>${s.shelter_id}</td>
            <td>${s.shelter_name}</td>
            <td>${displayAddress}</td>
            <td>${displayType}</td> 
            <td>
                <button class="delete-btn" data-id="${s.shelter_id}">삭제</button>
            </td>
        `;
        listContainer.appendChild(row);
      });

      totalCountSpan.textContent = totalItems;
      renderPagination(totalPages, page);
    } catch (error) {
      console.error('로드 실패:', error);
      listContainer.innerHTML = '<tr><td colspan="5" style="text-align: center;">데이터 로드 중 오류가 발생했습니다.</td></tr>';
    }
  }

  // (요청 1) 페이지네이션 버튼 렌더링
  function renderPagination(totalPages, page) {
    paginationContainer.innerHTML = '';

    // "이전" 버튼
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '이전';
    prevBtn.disabled = page <= 1;
    prevBtn.addEventListener('click', () => {
      if (page > 1) loadShelters(page - 1, currentSearch, currentType);
    });
    paginationContainer.appendChild(prevBtn);

    // 페이지 번호 (간단하게 현재 페이지 기준 5개만)
    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, page + 2);

    if (page <= 2) endPage = Math.min(totalPages, 5);
    if (page >= totalPages - 2) startPage = Math.max(1, totalPages - 4);

    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.textContent = i;
      if (i === page) {
        pageBtn.classList.add('active');
        pageBtn.disabled = true;
      }
      pageBtn.addEventListener('click', () => loadShelters(i, currentSearch, currentType));
      paginationContainer.appendChild(pageBtn);
    }

    // "다음" 버튼
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '다음';
    nextBtn.disabled = page >= totalPages;
    nextBtn.addEventListener('click', () => {
      if (page < totalPages) loadShelters(page + 1, currentSearch, currentType);
    });
    paginationContainer.appendChild(nextBtn);
  }

  // (요청 2) 검색 버튼 이벤트
  searchBtn.addEventListener('click', () => {
    loadShelters(1, searchInput.value, typeSearch.value);
  });

  // (요청 2) 엔터 키로 검색
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchBtn.click();
    }
  });

  // 대피소 추가
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      shelter_name: document.getElementById('name').value,
      address: document.getElementById('address').value,
      latitude: parseFloat(document.getElementById('lat').value),
      longitude: parseFloat(document.getElementById('lng').value),
      shelter_type: document.getElementById('type').value, // select의 value를 읽어옴
    };

    // [수정] 빈 값(유형 선택)인지 확인
    if (!data.shelter_type) {
      alert('대피소 유형을 선택해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/admin/shelters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        // [수정] 성공 알림 추가
        alert('대피소가 성공적으로 추가되었습니다.');
        form.reset();
        // 추가 후 1페이지로 이동
        loadShelters(1, '', ''); // 검색 조건 초기화하며 1페이지 로드
      } else {
        const errorData = await response.json();
        alert(`추가 실패: ${errorData.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('추가 실패:', error);
      alert('서버 통신 중 오류가 발생했습니다.');
    }
  });

  // 대피소 삭제
  listContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const id = e.target.dataset.id;
      if (!confirm(`ID ${id} 대피소를 삭제하시겠습니까?`)) return;

      try {
        const response = await fetch(`/api/admin/shelters/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          // 삭제 후 현재 페이지 다시 로드
          loadShelters(currentPage, currentSearch, currentType);
        } else {
          alert('삭제 실패');
        }
      } catch (error) {
        console.error('삭제 실패:', error);
      }
    }
  });

  // 로그아웃
  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/';
  });

  // 초기 로드
  loadShelters(1, '', '');
});
