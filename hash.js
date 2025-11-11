const bcrypt = require('bcrypt');
const saltRounds = 10; // 암호화 강도 (10~12가 적당)
const myPassword = 'admin1'; // 원하는 비밀번호

bcrypt.hash(myPassword, saltRounds, (err, hash) => {
  if (err) {
    console.error('해시 생성 오류:', err);
    return;
  }
  console.log('생성된 해시 (이것을 DB에 복사하세요):');
  console.log(hash);
});
