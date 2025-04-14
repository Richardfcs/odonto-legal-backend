# odonto-legal-backend
Nosso trabalho para o Projeto PI, tem como missão fazer o backend para a aplicação responsiva focada para o mobile

requisitos: node instalado
fazer um arquivo .env contendo:
MONGO_URI={"o link do seu banco de dados mongodb atlas"}
PORT={porta que queira}
SECRET={uma senha aleatória}

npm i

node src/app.js

depois de garantir que está funcionando vá ao postman, (tem extensão recomendo usá-la)
teste esses endereços:

GET http://localhost:3000/api
POST http://localhost:3000/api 
no body do Post, coloque raw, em seguida json e lá dentro faça como esse molde:
{
    "name": "exemplo",
    "email": "exemplo@gmail.com",
    "telephone": "exemplo",
    "password": "exemplo",
    "cro": "exemplo(tem que ser apenas numeral)"
}

pronto para adicionar funcionalidades:
1. criar nova pasta no models para criar uma nova tabela
2. criar suas funções no controller
3. criar as rotas em Routes
4. em app.js adicione a rota feita
5. agora é só testar no Postman

Para modificar as funcionalidades é só ter atenção em cada pasta dela e criando novas rotas se necessário.
(caso precise de um banco de dados pode me pedir que mando o link)

Vamos pra fente!

## criar usuários json:
{
    "name": "exemplo",
    "email": "exemplo@gmail.com",
    "telephone": "exemplo",
    "password": "exemplo",
    "cro": "exemplo"
}

## criar casos json:

{
    "nameCase": "exemplo",
    "Description": "exemplo",
    "status": "exemplo", // cuidado tem status específicos no enum
    "location": "exemplo",
    "category": "crime" // cuidado há categorias específicas
}

## criar evidências json:

{
    "caseId": "exemplo", // Substitua pelo ID de um caso existente
    "evidenceType": "text_description", // tem tipos específicos
    "title": "Descrição Inicial do Caso",
    "data": "Paciente do sexo masculino, aproximadamente 30 anos, encontrado..."
    // "description": "Notas adicionais sobre a evidência..." (opcional)
    "category": "pericial_findings" // opcional mas recomendado
}