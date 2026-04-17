const express = require('express');
const app = express();

app.get('/', (req, res) => {
  console.log(`[${new Date().toISOString()}] GET / 요청`);
  res.send('OK');
});

app.get('/callback', async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n========== OAuth 콜백 시작 [${timestamp}] ==========`);

  const code = req.query.code;
  const error = req.query.error;

  console.log(`[${timestamp}] 쿼리 파라미터:`);
  console.log(`  - code: ${code ? code.substring(0, 20) + '...' : 'None'}`);
  console.log(`  - error: ${error || 'None'}`);

  if (error) {
    console.error(`[${timestamp}] ❌ Discord OAuth 오류: ${error}`);
    return res.status(400).send(`OAuth 오류: ${error}`);
  }

  if (!code) {
    console.error(`[${timestamp}] ❌ 코드 없음`);
    return res.send('코드 없음');
  }

  try {
    // 1단계: 토큰 교환
    console.log(`[${timestamp}] 1️⃣ 토큰 교환 시작`);
    console.log(`  - CLIENT_ID: ${process.env.CLIENT_ID ? process.env.CLIENT_ID.substring(0, 10) + '...' : 'NOT SET'}`);
    console.log(`  - CLIENT_SECRET: ${process.env.CLIENT_SECRET ? '***' : 'NOT SET'}`);

    const params = new URLSearchParams();
    params.append('client_id', process.env.CLIENT_ID);
    params.append('client_secret', process.env.CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', 'https://discord-auth-1.onrender.com/callback');

    console.log(`[${timestamp}] Discord API에 요청 중...`);
    const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    console.log(`[${timestamp}] Discord 응답: ${tokenRes.status} ${tokenRes.statusText}`);

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error(`[${timestamp}] ❌ 토큰 교환 실패:`);
      console.error(`  - 상태: ${tokenRes.status}`);
      console.error(`  - 응답: ${JSON.stringify(tokenData)}`);
      return res.status(tokenRes.status).send(`토큰 교환 실패: ${tokenRes.status}`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    console.log(`[${timestamp}] ✅ 토큰 교환 성공`);
    console.log(`  - Access Token: ${accessToken.substring(0, 30)}...`);
    console.log(`  - Refresh Token: ${refreshToken ? refreshToken.substring(0, 30) + '...' : 'None'}`);
    console.log(`  - Expires In: ${expiresIn}초`);

    // 2단계: 사용자 정보 조회
    console.log(`[${timestamp}] 2️⃣ 사용자 정보 조회 중...`);
    const userRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`[${timestamp}] 사용자 API 응답: ${userRes.status} ${userRes.statusText}`);

    if (!userRes.ok) {
      console.error(`[${timestamp}] ❌ 사용자 정보 조회 실패: ${userRes.status}`);
      return res.status(userRes.status).send('사용자 정보 조회 실패');
    }

    const user = await userRes.json();

    console.log(`[${timestamp}] ✅ 사용자 정보 조회 성공`);
    console.log(`  - Username: ${user.username}`);
    console.log(`  - User ID: ${user.id}`);
    console.log(`  - Email: ${user.email || 'None'}`);

    // 3단계: Python 봇에 토큰 저장 요청
    console.log(`[${timestamp}] 3️⃣ Python 봇에 토큰 저장 요청 중...`);
    const BOT_SERVER = process.env.BOT_SERVER || 'http://localhost:8081';
    console.log(`  - BOT_SERVER: ${BOT_SERVER}`);
    console.log(`  - 전체 URL: ${BOT_SERVER}/api/save-token`);

    const saveTokenBody = JSON.stringify({
      user_id: user.id,
      username: user.username,
      access_token: accessToken,
      refresh_token: refreshToken
    });

    console.log(`[${timestamp}] 요청 바디 크기: ${saveTokenBody.length}바이트`);

    try {
      const saveRes = await fetch(`${BOT_SERVER}/api/save-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: saveTokenBody,
        timeout: 5000
      });

      console.log(`[${timestamp}] Python 봇 응답: ${saveRes.status} ${saveRes.statusText}`);

      if (saveRes.ok) {
        const saveData = await saveRes.json();
        console.log(`[${timestamp}] ✅ 토큰 저장 성공`);
        console.log(`  - 응답: ${JSON.stringify(saveData)}`);
      } else {
        console.warn(`[${timestamp}] ⚠️ 토큰 저장 응답 오류: ${saveRes.status}`);
        const errText = await saveRes.text();
        console.warn(`  - 응답 바디: ${errText}`);
      }
    } catch (err) {
      console.error(`[${timestamp}] ❌ 토큰 저장 요청 실패 (네트워크 오류)`);
      console.error(`  - 오류: ${err.message}`);
      console.error(`  - 스택: ${err.stack}`);
    }

    console.log(`[${timestamp}] ========== OAuth 콜백 완료 ==========\n`);
    res.send(`인증됨 이제 창을 닫아도 됩니다!`);

  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ 예상치 못한 오류`);
    console.error(`  - 메시지: ${error.message}`);
    console.error(`  - 스택: ${error.stack}`);
    res.status(500).send(`오류 발생: ${error.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🌐 Render OAuth 서버 시작됨 (포트 ${PORT})`);
  console.log(`[${timestamp}] 설정:`);
  console.log(`  - CLIENT_ID: ${process.env.CLIENT_ID ? '✅ 설정됨' : '❌ 미설정'}`);
  console.log(`  - CLIENT_SECRET: ${process.env.CLIENT_SECRET ? '✅ 설정됨' : '❌ 미설정'}`);
  console.log(`  - BOT_SERVER: ${process.env.BOT_SERVER || '기본값 사용 (http://localhost:8081)'}`);
  console.log(`\n`);
});
