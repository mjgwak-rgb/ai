# ai

작업 모음 저장소입니다.

## 프로젝트

| 폴더 | 설명 |
|---|---|
| [lotto](./lotto) | 로또 6/45 번호 자동 생성기 — 역대 당첨번호 통계 반영 (브라우저에서 `lotto/index.html` 열기) |

### lotto 데이터 갱신

```
node lotto/scripts/update-data.mjs
```

`lotto/data/`에 역대 당첨번호(`draws.json`, `draws.csv`, `draws.js`)가 저장돼요. 새 회차만 추가로 받아와요.
