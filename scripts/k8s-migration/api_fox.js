// 定义发送登录接口请求方法
function sendLoginRequest() {
  // 获取环境里的 前置 URL
  const baseUrl = pm.request.getBaseUrl();


  // 登录用户名，这里从环境变量 LOGIN_USERNAME 获取，也可以写死（但是不建议）
  const authCode = pm.environment.get("REO_SESS_AUTH_CODE");
  const clientId = pm.environment.get("CLIENT_ID");
  console.log(clientId)
  // 构造一个 POST x-www-form-urlencoded 格式请求。这里需要改成你们实际登录接口的请求参数。
  const loginRequest = {
    url: baseUrl + "/v1.0/oauth2/token/",
    method: "POST",
    header: {
        "host": "apis.reolink.dev",
        "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Google Chrome\;v=\"138\"",
        "Accept": "application/json, text/plain, */*",
        "X-PRID": "250711025808359-d7037e49-W9IA5mH",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "Windows",
        "Origin": "https://my.reolink.dev",
        "x-gray-tag": "k8s",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive"
    },
    // body 为 x-www-form-urlencoded 格式
    body: {
      mode: "urlencoded", // 此处为 urlencoded
      // 此处为 urlencoded
      urlencoded: [
        { key: "clinet_id", value: clientId },
        { key: "code", value: authCode },
        { key: "grant_type", value: "session_implicit" },
      ],
    },
  };

  // 发送请求。
  // pm.sendrequest 参考文档: https://apifox.com/help/app/scripts/api-references/pm-reference/#pm-sendrequest
  pm.sendRequest(loginRequest, function(err, res) {
    if (err) {
      console.log(err);
    } else {
      // 读取接口返回的 json 数据。
      // 如果你的 token 信息是存放在 cookie 的，可以使用 res.cookies.get('token') 方式获取。
      // cookies 参考文档：https://apifox.com/help/app/scripts/api-references/pm-reference/#pm-cookies
      const jsonData = res.json();
      // 将 accessToken 写入环境变量 ACCESS_TOKEN
      pm.environment.set("REO_ACCESS_TOKEN", jsonData.access_token);
      // 将 accessTokenExpires 过期时间写入环境变量 ACCESS_TOKEN_EXPIRES
      pm.environment.set(
        "REO_ACCESS_TOKEN_EXPIRES",
        Date.now() + jsonData.expires_in
      );
    }
  });
}

// 获取环境变量里的 ACCESS_TOKEN
const accessToken = pm.environment.get("REO_ACCESS_TOKEN");

// 获取环境变量里的 ACCESS_TOKEN_EXPIRES
const accessTokenExpires = pm.environment.get("REO_ACCESS_TOKEN_EXPIRES");

// 如 ACCESS_TOKEN 没有值，或 ACCESS_TOKEN_EXPIRES 已过期，则执行发送登录接口请求
if (
  !accessToken ||
  (accessTokenExpires && new Date(accessTokenExpires) <= new Date())
) {
  sendLoginRequest();
}
