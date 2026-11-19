# PAINT TAC 3D v0.3 — ativação

## Firebase Console

1. Authentication > Sign-in method: mantenha **Anônimo** ativo e habilite **E-mail/senha** (não é necessário habilitar "Link por e-mail").
2. Realtime Database > Regras: copie e publique o arquivo [firebase-rules.json](firebase-rules.json) do repositório.
3. Hosting: o site continua no GitHub Pages; não é preciso Render para as funções básicas.

## Testes em dois aparelhos

- Abra a página com ?v=030 no iPhone e Android.
- Conta Ghost: abra o perfil, vincule e-mail e senha. Para testar recuperação de conta, use outro navegador e faça login.
- Busca rápida: toque em "Buscar partida rápida 1v1" nos dois aparelhos. Um cria a sala na fila e o outro entra.
- Amigos: adicione o código de amigo, aceite, e toque em "Convidar" na lista. O convidado deve manter o jogo aberto para ver o convite.
- As salas por código da v0.2 continuam disponíveis.

## Limitações importantes

- O matchmaking é uma **fila simples global** (um slot). Não possui região, habilidade, servidor dedicado, heartbeat ou proteção contra abandonos; partidas rápidas devem ser testadas antes de lançamento público.
- Os convites aparecem enquanto a página está aberta, não são notificações push.
- Ranking e resultado são atualizados pelo cliente. Não há antitrapaça autoritativa. Para produção, use backend confiável e regras mais restritas.
- A autenticação anônima pode ser perdida ao limpar os dados do navegador. Vincule o e-mail antes de trocar de dispositivo.
- Trocar para novo convidado abandona o login atual. Se a conta antiga não estiver vinculada, poderá ser irrecuperável.
