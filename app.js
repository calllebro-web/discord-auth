const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('OK');
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) return res.send('코드 없음');

  try {
    // 1단계: 토큰 교환
    const params = new URLSearchParams();
    params.append('client_id', process.env.CLIENT_ID);
    params.append('client_secret', process.env.CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', 'https://discord-auth-1.onrender.com/callback');

    const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2단계: 사용자 정보 조회
    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const user = await userRes.json();
    const refreshToken = tokenData.refresh_token;

    console.log(`✅ 사용자 인증: ${user.username} (ID: ${user.id})`);

    // Python 봇에 토큰 저장 요청
    const BOT_SERVER = process.env.BOT_SERVER || 'http://localhost:8081';

    try {
      await fetch(`${BOT_SERVER}/api/save-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          username: user.username,
          access_token: accessToken,
          refresh_token: refreshToken
        })
      });
      console.log(`✅ 토큰 저장 요청 완료`);
    } catch (err) {
      console.warn(`⚠️ 토큰 저장 요청 실패: ${err.message}`);
    }

    res.send(`인증됨 이제 창을 닫아도 됩니다!`);

  } catch (error) {
    console.error(`❌ 오류: ${error.message}`);
    res.status(500).send(`오류 발생: ${error.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
