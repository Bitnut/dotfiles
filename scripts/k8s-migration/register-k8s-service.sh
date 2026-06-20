#!/bin/sh

curl 'https://apis.reolink.dev/v1.0/management/endpoints/services' \
  -X 'PUT' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7' \
  -H 'authorization: Bearer AAIDAIBwAADJKDCZnAEAAICAIwSJDQEABAAAAAUEAADqpAEA4TO_6QKrl8bFn9dDIDIeSu9YPnC_8j5Pes5XoJ-rb0s' \
  -H 'cache-control: no-cache' \
  -H 'content-type: application/json' \
  -b '_gcl_au=1.1.1208308856.1768536193; REO_CLOUD_LANGUAGE=en; _rdt_uuid=1770782683832.24c97043-cb71-4087-9108-809274dbd626; _ga_YRPWFEN402=GS2.1.s1770782684$o9$g0$t1770782684$j60$l0$h0; _ga_FGC5ZNTL9K=GS2.1.s1770782684$o9$g0$t1770782684$j60$l0$h0; reolink_secure_code=4V0mcQ5LltOSYRqevwKr; _ga=GA1.2.1000676815.1768528548; _gid=GA1.2.1285616860.1772002163; REO_ONLINE_SIGN=1773211814218; REO_SESS_AUTH_CODE=AwEDAAAAAAC0PpCTnAEAAIpwaLQzNQEAw0wDAAAAAACUwepN2sPzPwlr2NJQzTirkA8MrcqpAVtmfNCXt0WnPw; _ga_EPHCTC8LVH=GS2.1.s1772002162$o5$g1$t1772002214$j8$l0$h0' \
  -H 'origin: https://admin.reolink.dev' \
  -H 'pragma: no-cache' \
  -H 'priority: u=1, i' \
  -H 'referer: https://admin.reolink.dev/' \
  -H 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' \
  -H 'x-gray-tag: k8s' \
  --data-raw '{"service":"ReolinkNewMultiSites","host":"r4-review-ingress.reolink.com","port":80,"path":"/svc-reolink-new-multi-sites","fxVer":"v1","protocol":"http","reload":true,"grayTag":"k8s","tags":["k8s","legacy"]}'
