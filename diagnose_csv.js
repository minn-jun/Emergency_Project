const fs = require('fs');
const path = require('path');

console.log('civildef_shelters.csv 파일 정밀 진단을 시작합니다...');

const filePath = path.join(__dirname, 'shelters', 'civildef_shelters.csv');

if (!fs.existsSync(filePath)) {
  console.error('[치명적 오류] 진단할 파일을 찾을 수 없습니다:', filePath);
  return;
}

const data = fs.readFileSync(filePath, 'utf8');
const lines = data.trim().split(/\r?\n/);

if (lines.length < 2) {
  console.log('[진단 완료] 파일에 데이터가 없습니다.');
  return;
}

const headerLine = lines[0].replace(/^\uFEFF/, '');
// 따옴표를 제거하고 양쪽 공백을 제거하여 헤더를 정리합니다.
const headers = headerLine
  .split(',')
  .map((h) => h.trim().replace(/^"|"$/g, ''));
const headerCount = headers.length;

console.log('파일 헤더:', headers);

const latIndex = headers.indexOf('위도');
const lngIndex = headers.indexOf('경도');

if (latIndex === -1 || lngIndex === -1) {
  console.error(
    "[치명적 오류] CSV 파일에서 '위도' 또는 '경도' 컬럼을 찾지 못했습니다."
  );
  console.error('-> 실제 헤더 이름을 다시 한번 확인해주세요.');
  return;
}

let errorCount = 0;

for (let i = 1; i < lines.length; i++) {
  const lineNumber = i + 1;
  const line = lines[i];

  if (!line.trim()) continue;

  const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

  // 1. 컬럼 개수 검사
  if (values.length !== headerCount) {
    console.log(
      `[문제 발견] ${lineNumber}행: 컬럼 개수가 맞지 않습니다. (예상: ${headerCount}개, 실제: ${values.length}개) -> 내용: ${line}`
    );
    errorCount++;
    continue; // 다른 검사는 의미 없으므로 다음 줄로 넘어감
  }

  const latValue = values[latIndex] ? values[latIndex].trim() : '';
  const lngValue = values[lngIndex] ? values[lngIndex].trim() : '';

  // 2. 좌표 값 존재 여부 검사
  if (latValue === '' || lngValue === '') {
    console.log(
      `[문제 발견] ${lineNumber}행: 위도 또는 경도 값이 비어있습니다.`
    );
    errorCount++;
  }
  // 3. 좌표 값이 숫자인지 검사 (비어있지 않을 때만)
  else if (isNaN(parseFloat(latValue)) || isNaN(parseFloat(lngValue))) {
    console.log(
      `[문제 발견] ${lineNumber}행: 위도('${latValue}') 또는 경도('${lngValue}') 값이 숫자가 아닙니다.`
    );
    errorCount++;
  }
}

console.log('--------------------------------------------------');
if (errorCount > 0) {
  console.log(`[진단 완료] 총 ${errorCount}개의 잠재적인 문제를 발견했습니다.`);
  console.log(
    '-> 위의 로그를 확인하여 CSV 파일을 수정하거나, 서버 코드의 예외 처리를 강화해야 합니다.'
  );
} else {
  console.log('[진단 완료] 파일에 명백한 구조적 문제는 발견되지 않았습니다.');
  console.log(
    '-> 문제가 계속된다면, 눈에 보이지 않는 특수 문자나 인코딩 문제일 수 있습니다.'
  );
}
