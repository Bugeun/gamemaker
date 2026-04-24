# GameMaker

브라우저에서 바로 돌아가는 웹게임 허브.

**Live:** https://bugeun.github.io/gamemaker/

## 구조

```
/
├── index.html      # 랜딩 (게임 카드 그리드)
└── games/          # 각 게임을 하위 폴더로
    └── <game>/
        └── index.html
```

## 게임 추가하는 법

1. `games/<game-name>/` 폴더 생성
2. 해당 폴더에 `index.html` 작성 — 모든 에셋은 **상대 경로**로
3. 루트 `index.html`의 카드 그리드에 링크 추가:
   ```html
   <a class="card" href="games/<game-name>/">...</a>
   ```
4. `git push` — GitHub Pages가 자동 배포

## 로컬 실행

순수 정적 파일이라 `index.html`을 바로 열어도 되고,
CORS가 필요한 리소스를 쓰는 게임이면 로컬 서버 권장:

```bash
python -m http.server 8000
# 또는
npx serve .
```

## 배포

`main` 브랜치에 push하면 GitHub Pages가 자동 빌드·배포합니다.
