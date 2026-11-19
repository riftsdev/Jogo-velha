# Firebase para PAINT TAC 3D
1. Acesse https://console.firebase.google.com e crie um projeto.
2. Adicione um app **Web** e copie apiKey, authDomain, projectId e appId.
3. Em **Build > Realtime Database**, crie o banco e copie databaseURL.
4. Em **Authentication > Sign-in method**, habilite **Anônimo**.
5. Cole as configurações em `firebase-config.js` no repositório.
6. Em **Realtime Database > Rules**, cole o conteúdo de `firebase-rules.json` e publique.
7. Espere o GitHub Pages atualizar e teste com dois celulares.

**Atenção:** este é um protótipo de multiplayer direto no Firebase. Como a lógica roda no cliente, jogadores mal-intencionados podem adulterar jogadas/tempo; para partidas competitivas é necessário validar no servidor (Cloud Functions ou backend). Não use regras abertas de leitura/escrita indiscriminadas. Salas são temporárias apenas enquanto os jogadores as mantêm.
