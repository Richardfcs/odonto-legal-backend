
## Instalação e Configuração

1.  **Clone o Repositório:**
    ```bash
    git clone https://github.com/Richardfcs/odonto-legal-backend
    cd odonto-legal-backend
    ```

2.  **Instale as Dependências:**
    ```bash
    npm install
    # ou
    yarn install
    ```
    *(Certifique-se de instalar `axios` e `dotenv` se ainda não o fez: `npm install axios dotenv`)*

3.  **Configure as Variáveis de Ambiente:**
    *   Crie um arquivo `.env` na pasta raiz do projeto (`odonto-legal-backend/`).
    *   Adicione as seguintes variáveis, substituindo pelos seus valores:

    ```dotenv
    # Configuração do Servidor
    PORT=3000

    # Conexão com MongoDB
    MONGO_URI=mongodb+srv://<user>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority

    # Segredo para JWT (Use um valor longo, aleatório e seguro)
    SECRET=SEU_SEGREDO_JWT_MUITO_SEGURO_E_LONGO

    # Chave da API OpenRouter (se estiver usando a funcionalidade de IA)
    OPENROUTER_API_KEY=sua_chave_openrouter_aqui

    # Ambiente (útil para logs de erro)
    NODE_ENV=development # Mude para 'production' no deploy
    ```
    *   **IMPORTANTE:** Adicione o arquivo `.env` ao seu `.gitignore`!

4.  **Fontes para PDFMake (Opcional, mas recomendado):**
    *   Crie a pasta `public/fonts/` na raiz do projeto backend.
    *   Baixe os arquivos `.ttf` da fonte Roboto (Regular, Medium/Bold, Italic, MediumItalic/BoldItalic) do Google Fonts.
    *   Coloque os arquivos `.ttf` dentro da pasta `public/fonts/`.
    *   Verifique se os nomes dos arquivos correspondem aos usados em `controllers/reportController.js`.

5.  **Pasta de Uploads:**
    *   Certifique-se de que a pasta `uploads/reports/` exista na raiz do projeto ou que o código em `controllers/reportController.js` (na função `salvarPDFNoStorage`) consiga criá-la.

## Executando a Aplicação

*   **Modo de Desenvolvimento (com nodemon para auto-reload):**
    ```bash
    npm run dev # Assumindo script "dev": "nodemon src/app.js"
    # ou
    nodemon src/app.js
    ```
*   **Modo de Produção:**
    ```bash
    npm start # Assumindo script "start": "node src/app.js"
    # ou
    node src/app.js
    ```

A API estará rodando em `http://localhost:PORTA` (ex: 3000).

## Endpoints da API

**Autenticação e Autorização:**

*   Todas as rotas (exceto `/api/user/login`) requerem um Token JWT válido enviado no header `Authorization` como `Bearer <token>`.
*   Endpoints específicos requerem roles de usuário (`admin`, `perito`, `assistente`) conforme indicado abaixo (Verificado pelo middleware `authorize`).

---

*   **Usuários (`/api/user`)**

    | Método | Rota               | Ação                                       | Acesso Permitido        | Necessita Auth (JWT)? |
    | :----- | :----------------- | :----------------------------------------- | :---------------------- | :-------------------- |
    | `POST` | `/login`           | Autentica usuário e retorna token + role   | Público                 | Não                   |
    | `GET`  | `/me`              | Retorna dados do usuário logado            | Admin, Perito, Assistente | Sim                   |
    | `GET`  | `/mycases`         | Lista casos associados ao usuário logado     | Admin, Perito, Assistente | Sim                   |
    | `GET`  | `/`                | Lista todos os usuários                    | Admin, Perito           | Sim                   |
    | `POST` | `/`                | Cria um novo usuário                       | Admin                   | Sim                   |
    | `GET`  | `/fname?name=...`  | Filtra usuários por nome                   | Admin, Perito           | Sim                   |
    | `GET`  | `/:id`             | Obtém um usuário específico por ID         | Admin, Perito           | Sim                   |
    | `PUT`  | `/:id`             | Atualiza dados de um usuário (verificar controller) | Admin (ou próprio user) | Sim                   |
    | `PATCH`| `/:id`             | Atualiza a role de um usuário              | Admin                   | Sim                   |
    | `DELETE`| `/:id`            | Exclui um usuário                          | Admin                   | Sim                   |
    | `GET`  | `/cases/:id`       | Obtém um usuário com seus casos populados | Admin, Perito           | Sim                   |

---

*   **Casos (`/api/case`)**

    | Método  | Rota                    | Ação                                      | Acesso Permitido          | Necessita Auth (JWT)? |
    | :------ | :---------------------- | :---------------------------------------- | :------------------------ | :-------------------- |
    | `GET`   | `/`                     | Lista todos os casos                      | Admin, Perito, Assistente | Sim                   |
    | `POST`  | `/`                     | Cria um novo caso                         | Admin, Perito             | Sim                   |
    | `GET`   | `/fname?nameCase=...` | Filtra casos por nome                     | Admin, Perito, Assistente | Sim                   |
    | `GET`   | `/fstatus?status=...` | Filtra casos por status                   | Admin, Perito, Assistente | Sim                   |
    | `GET`   | `/fdata?order=...`    | Filtra/Ordena casos por data de criação | Admin, Perito, Assistente | Sim                   |
    | `GET`   | `/fcat?category=...`  | Filtra casos por categoria                | Admin, Perito, Assistente | Sim                   |
    | `GET`   | `/fdatacase?startDate=...`| Filtra casos pela data do caso            | Admin, Perito, Assistente | Sim                   |
    | `GET`   | `/:id`                  | Obtém um caso específico por ID         | Admin, Perito, Assistente | Sim                   |
    | `PUT`   | `/:id`                  | Atualiza um caso                          | Admin, Perito             | Sim                   |
    | `DELETE`| `/:id`                  | Exclui um caso                            | Admin, Perito             | Sim                   |
    | `POST`  | `/:caseId/analyze`      | Executa análise com IA (opcional)       | Admin, Perito             | Sim                   |

---

*   **Evidências (`/api/evidence`)**

    | Método  | Rota        | Ação                             | Acesso Permitido   | Necessita Auth (JWT)? |
    | :------ | :---------- | :------------------------------- | :----------------- | :-------------------- |
    | `POST`  | `/`         | Cria uma nova evidência          | Admin, Perito      | Sim                   |
    | `GET`   | `/`         | Lista TODAS as evidências (geral)| Admin              | Sim                   |
    | `GET`   | `/:caseId`  | Lista evidências de um caso      | Admin, Perito, Assistente | Sim                   |
    | `PUT`   | `/:id`      | Atualiza uma evidência específica| Admin, Perito      | Sim                   |
    | `DELETE`| `/:id`      | Exclui uma evidência específica  | Admin, Perito      | Sim                   |

---

*   **Laudos (`/api/report`)**

    | Método  | Rota               | Ação                               | Acesso Permitido   | Necessita Auth (JWT)? |
    | :------ | :----------------- | :--------------------------------- | :----------------- | :-------------------- |
    | `POST`  | `/`                | Gera um novo laudo em PDF          | Admin, Perito      | Sim                   |
    | `GET`   | `/download/:reportId`| Faz download do PDF de um laudo | Admin, Perito, Assistente | Sim                   |
    | `GET`   | `/`                | Lista registros de laudo          | *(Não implementado)* | *Sim*                 |
    | `GET`   | `/:id`             | Obtém registro de laudo           | *(Não implementado)* | *Sim*                 |
    | `DELETE`| `/:id`             | Exclui registro/PDF de laudo     | *(Não implementado)* | *Admin*               |

---

*   **Logs de Auditoria (`/api/auditlog`)**

    | Método | Rota     | Ação                                   | Acesso Permitido | Necessita Auth (JWT)? |
    | :----- | :------- | :------------------------------------- | :--------------- | :-------------------- |
    | `GET`  | `/`      | Lista logs de auditoria com paginação | Admin            | Sim                   |
    | `GET`  | `/:id`   | Obtém um log específico               | *(Não implementado)* | *Admin*           |

---

## Diagrama do Banco de Dados (Conceitual)

*   **User:** Contém informações do usuário (nome, email, senha hash, role, cro, foto). Possui referência aos `Cases` dos quais é responsável ou membro da equipe.
*   **Case:** Contém informações do caso pericial (nome, descrição, status, local, data, etc.). Possui referência ao `User` responsável (`responsibleExpert`), um array de referências aos `Users` da equipe (`team`), e um array de referências às `Evidences` associadas.
*   **Evidence:** Contém informações da evidência (tipo, título, descrição, dados, categoria). Possui referência ao `Case` ao qual pertence (`caseId`) e ao `User` que a coletou/registrou (`collectedBy`).
*   **Report:** Contém metadados do laudo gerado (conteúdo textual, URL do PDF). Possui referência ao `Case` ao qual pertence (`caseId`) e ao `User` que o assinou/gerou (`signedBy`).
*   **AuditLog:** Contém registros das ações realizadas no sistema. Possui referência ao `User` que realizou a ação (`userId`) e informações sobre a ação e o alvo (`action`, `targetModel`, `targetId`, `details`).
