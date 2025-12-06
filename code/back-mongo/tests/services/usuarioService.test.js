// IMPLEMENTAÇÃO FUTURA - Testes do UsuarioService MongoDB
// PROBLEMA: Jest não consegue resolver módulos quando executado em lote
// STATUS: Não funciona - erro "Cannot find module '../src/services/usuarioService'"
// SOLUÇÃO: Aguardar correção da configuração do Jest ou refatoração dos imports

/*
const UsuarioService = require('../src/services/usuarioService');
const User = require('../src/models/User');
const bcrypt = require('bcrypt');
const { STATUS, IDIOMAS_SUPORTADOS } = require('../../constants');

describe('UsuarioService MongoDB', () => {
    describe('Cadastro de Usuário', () => {
        test('deve cadastrar um usuário com sucesso', async () => {
            const dadosUsuario = {
                nome: 'João Silva',
                email: 'joao@test.com',
                numeroTelefone: 5511999999999,
                senha: 'senha123',
                idiomaPadrao: 'pt-BR'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);

            expect(usuario).toBeDefined();
            expect(usuario.nome).toBe('João Silva');
            expect(usuario.email).toBe('joao@test.com');
            expect(usuario.numeroTelefone).toBe(5511999999999);
            expect(usuario.idiomaPadrao).toBe('pt-BR');
            expect(usuario.status).toBe(STATUS.OFFLINE);
            expect(usuario.senha).toBeDefined();
            expect(usuario.senha).not.toBe('senha123'); // Deve estar hasheada
            expect(usuario._id).toBeDefined();
        });

        test('deve usar idioma padrão pt-BR quando não especificado', async () => {
            const dadosUsuario = {
                nome: 'Maria Santos',
                email: 'maria@test.com',
                senha: 'senha123'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);

            expect(usuario.idiomaPadrao).toBe('pt-BR');
        });

        test('deve falhar ao cadastrar usuário com email duplicado', async () => {
            const dadosUsuario = {
                nome: 'Primeiro Usuário',
                email: 'duplicado@test.com',
                senha: 'senha123'
            };

            await UsuarioService.cadastrar(dadosUsuario);

            const dadosUsuario2 = {
                nome: 'Segundo Usuário',
                email: 'duplicado@test.com',
                senha: 'senha456'
            };

            await expect(UsuarioService.cadastrar(dadosUsuario2))
                .rejects.toThrow('Email já cadastrado');
        });

        test('deve falhar ao cadastrar usuário com telefone duplicado', async () => {
            const dadosUsuario = {
                nome: 'Primeiro Usuário',
                email: 'primeiro@test.com',
                numeroTelefone: 5511888888888,
                senha: 'senha123'
            };

            await UsuarioService.cadastrar(dadosUsuario);

            const dadosUsuario2 = {
                nome: 'Segundo Usuário',
                email: 'segundo@test.com',
                numeroTelefone: 5511888888888,
                senha: 'senha456'
            };

            await expect(UsuarioService.cadastrar(dadosUsuario2))
                .rejects.toThrow('Número de telefone já cadastrado');
        });

        test('deve normalizar email e telefone', async () => {
            const dadosUsuario = {
                nome: 'Test User',
                email: 'TEST@EXAMPLE.COM',
                numeroTelefone: '(11) 99999-9999',
                senha: 'senha123'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);

            expect(usuario.email).toBe('test@example.com');
            expect(usuario.numeroTelefone).toBe('5511999999999');
        });
    });

    describe('Login de Usuário', () => {
        let userId;

        beforeEach(async () => {
            const dadosUsuario = {
                nome: 'Login User',
                email: 'login@test.com',
                senha: 'senha123'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);
            userId = usuario._id;
        });

        test('deve fazer login com sucesso', async () => {
            const usuario = await UsuarioService.login('login@test.com', 'senha123');

            expect(usuario).toBeDefined();
            expect(usuario.email).toBe('login@test.com');
            expect(usuario.status).toBe(STATUS.ONLINE); // Deve alterar para online
        });

        test('deve falhar com usuário inexistente', async () => {
            await expect(UsuarioService.login('inexistente@test.com', 'senha123'))
                .rejects.toThrow('Usuário não encontrado');
        });

        test('deve falhar com senha incorreta', async () => {
            await expect(UsuarioService.login('login@test.com', 'senhaerrada'))
                .rejects.toThrow('Senha inválida');
        });

        test('deve normalizar email no login', async () => {
            const usuario = await UsuarioService.login('LOGIN@TEST.COM', 'senha123');

            expect(usuario).toBeDefined();
            expect(usuario.email).toBe('login@test.com');
        });
    });

    describe('Alteração de Status', () => {
        let userId;

        beforeEach(async () => {
            const dadosUsuario = {
                nome: 'Status User',
                email: 'status@test.com',
                senha: 'senha123'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);
            userId = usuario._id;
        });

        test('deve alterar status para online', async () => {
            const usuario = await UsuarioService.alterarStatus(userId, STATUS.ONLINE);

            expect(usuario.status).toBe(STATUS.ONLINE);
        });

        test('deve alterar status para ocupado', async () => {
            const usuario = await UsuarioService.alterarStatus(userId, STATUS.OCUPADO);

            expect(usuario.status).toBe(STATUS.OCUPADO);
        });

        test('deve falhar com usuário inexistente', async () => {
            const fakeId = '507f1f77bcf86cd799439999';

            await expect(UsuarioService.alterarStatus(fakeId, STATUS.ONLINE))
                .rejects.toThrow('Usuário não encontrado');
        });
    });

    describe('Alteração de Idioma', () => {
        let userId;

        beforeEach(async () => {
            const dadosUsuario = {
                nome: 'Language User',
                email: 'lang@test.com',
                senha: 'senha123',
                idiomaPadrao: 'pt-BR'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);
            userId = usuario._id;
        });

        test('deve alterar idioma para inglês', async () => {
            const usuario = await UsuarioService.alterarIdioma(userId, 'en-US');

            expect(usuario.idiomaPadrao).toBe('en-US');
        });

        test('deve alterar idioma para espanhol', async () => {
            const usuario = await UsuarioService.alterarIdioma(userId, 'es-ES');

            expect(usuario.idiomaPadrao).toBe('es-ES');
        });

        test('deve falhar com idioma não suportado', async () => {
            await expect(UsuarioService.alterarIdioma(userId, 'ko-KR'))
                .rejects.toThrow('Idioma não suportado');
        });

        test('deve falhar com usuário inexistente', async () => {
            const fakeId = '507f1f77bcf86cd799439999';

            await expect(UsuarioService.alterarIdioma(fakeId, 'en-US'))
                .rejects.toThrow('Usuário não encontrado');
        });
    });

    describe('Busca de Usuários', () => {
        beforeEach(async () => {
            const usuarios = [
                { nome: 'Alice Silva', email: 'alice@test.com', numeroTelefone: 5511111111111, senha: 'senha123' },
                { nome: 'Bob Santos', email: 'bob@test.com', numeroTelefone: 5511222222222, senha: 'senha123' },
                { nome: 'Carlos Lima', email: 'carlos@test.com', senha: 'senha123' }
            ];

            for (const dadosUsuario of usuarios) {
                await UsuarioService.cadastrar(dadosUsuario);
            }
        });

        test('deve buscar usuário por email', async () => {
            const usuarios = await UsuarioService.buscarUsuarios({
                searchParams: { email: 'alice@test.com' }
            });

            expect(usuarios).toHaveLength(1);
            expect(usuarios[0].nome).toBe('Alice Silva');
            expect(usuarios[0].email).toBe('alice@test.com');
        });

        test('deve buscar usuário por telefone', async () => {
            const usuarios = await UsuarioService.buscarUsuarios({
                searchParams: { numeroTelefone: 5511111111111 }
            });

            expect(usuarios).toHaveLength(1);
            expect(usuarios[0].nome).toBe('Alice Silva');
        });

        test('deve buscar usuário por nome parcial', async () => {
            const usuarios = await UsuarioService.buscarUsuarios({
                searchParams: { nome: { $regex: 'Silva', $options: 'i' } }
            });

            expect(usuarios).toHaveLength(1);
            expect(usuarios[0].nome).toBe('Alice Silva');
        });

        test('deve retornar lista vazia quando não encontrar', async () => {
            const usuarios = await UsuarioService.buscarUsuarios({
                searchParams: { email: 'inexistente@test.com' }
            });

            expect(usuarios).toHaveLength(0);
        });

        test('deve falhar sem critérios de busca', async () => {
            await expect(UsuarioService.buscarUsuarios({}))
                .rejects.toThrow('Forneça pelo menos um critério: telefone, email ou nome');
        });

        test('deve aplicar limite e offset', async () => {
            const usuarios = await UsuarioService.buscarUsuarios({
                searchParams: {},
                limit: 2,
                offset: 1
            });

            expect(usuarios).toHaveLength(2);
        });
    });

    describe('Gerenciamento de Contatos', () => {
        let userId, contactId;

        beforeEach(async () => {
            const dadosUsuario = {
                nome: 'Main User',
                email: 'main@test.com',
                senha: 'senha123'
            };
            const usuario = await UsuarioService.cadastrar(dadosUsuario);
            userId = usuario._id;

            const dadosContato = {
                nome: 'Contact User',
                email: 'contact@test.com',
                senha: 'senha123'
            };
            const contato = await UsuarioService.cadastrar(dadosContato);
            contactId = contato._id;
        });

        test('deve adicionar contato por ID', async () => {
            const resultado = await UsuarioService.adicionarContato(userId, contactId, 'Amigo');

            expect(resultado).toBeDefined();
            expect(resultado.contatoId.toString()).toBe(contactId.toString());
            expect(resultado.apelido).toBe('Amigo');
            expect(resultado.contato.nome).toBe('Contact User');
        });

        test('deve adicionar contato por email', async () => {
            const resultado = await UsuarioService.adicionarContatoPorEmail(userId, 'contact@test.com', 'Amigo');

            expect(resultado).toBeDefined();
            expect(resultado.contato.email).toBe('contact@test.com');
            expect(resultado.apelido).toBe('Amigo');
        });

        test('deve adicionar contato por telefone', async () => {
            // Primeiro adicionar telefone ao contato
            // Atualiza o perfil do contato para incluir o número de telefone
            await UsuarioService.atualizarPerfil(contactId, { numeroTelefone: '5511999999999' });

            const resultado = await UsuarioService.adicionarContatoPorTelefone(userId, '5511999999999', 'Amigo');

            expect(resultado).toBeDefined();
            expect(resultado.apelido).toBe('Amigo');
        });

        test('deve impedir adicionar a si mesmo como contato', async () => {
            await expect(UsuarioService.adicionarContato(userId, userId))
                .rejects.toThrow('Você não pode adicionar a si mesmo como contato');
        });

        test('deve remover contato', async () => {
            await UsuarioService.adicionarContato(userId, contactId, 'Amigo');

            const resultado = await UsuarioService.removerContato(userId, contactId);

            expect(resultado.success).toBe(true);
        });

        test('deve listar contatos', async () => {
            await UsuarioService.adicionarContato(userId, contactId, 'Amigo');

            const contatos = await UsuarioService.listarContatos(userId);

            expect(contatos).toHaveLength(1);
            expect(contatos[0].apelido).toBe('Amigo');
            expect(contatos[0].contato.nome).toBe('Contact User');
        });

        test('deve editar apelido do contato', async () => {
            await UsuarioService.adicionarContato(userId, contactId, 'Apelido Antigo');

            const resultado = await UsuarioService.editarApelido(userId, contactId, 'Novo Apelido');

            expect(resultado.success).toBe(true);
        });
    });

    describe('Perfil do Usuário', () => {
        let userId;

        beforeEach(async () => {
            const dadosUsuario = {
                nome: 'Profile User',
                email: 'profile@test.com',
                senha: 'senha123'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);
            userId = usuario._id;
        });

        test('deve obter perfil do usuário', async () => {
            const perfil = await UsuarioService.obterPerfil(userId);

            expect(perfil).toBeDefined();
            expect(perfil.nome).toBe('Profile User');
            expect(perfil.email).toBe('profile@test.com');
        });

        test('deve atualizar perfil', async () => {
            const dadosAtualizacao = {
                nome: 'Nome Atualizado',
                status: STATUS.ONLINE
            };

            const perfilAtualizado = await UsuarioService.atualizarPerfil(userId, dadosAtualizacao);

            expect(perfilAtualizado.nome).toBe('Nome Atualizado');
            expect(perfilAtualizado.status).toBe(STATUS.ONLINE);
        });

        test('deve alterar senha', async () => {
            const resultado = await UsuarioService.alterarSenha(userId, 'senha123', 'novasenha456');

            expect(resultado.success).toBe(true);
            expect(resultado.message).toBe('Senha alterada com sucesso');
        });

        test('deve falhar ao alterar senha com senha atual incorreta', async () => {
            await expect(UsuarioService.alterarSenha(userId, 'senhaerrada', 'novasenha456'))
                .rejects.toThrow('Senha atual incorreta');
        });

        test('deve falhar ao alterar senha com nova senha muito curta', async () => {
            await expect(UsuarioService.alterarSenha(userId, 'senha123', '123'))
                .rejects.toThrow('A nova senha deve ter pelo menos 6 caracteres');
        });
    });
});
*/

// Ensure required services/constants are available for the active tests below
const UsuarioService = require('../../src/services/usuarioService');
const { STATUS } = require('../../constants');

describe('UsuarioService MongoDB', () => {
    describe('Cadastro de Usuário', () => {
        test('deve cadastrar um usuário com sucesso', async () => {
            const dadosUsuario = {
                nome: 'João Silva',
                email: 'joao@test.com',
                numeroTelefone: 5511999999999,
                senha: 'senha123',
                idiomaPadrao: 'pt-BR'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);

            expect(usuario).toBeDefined();
            expect(usuario.nome).toBe('João Silva');
            expect(usuario.email).toBe('joao@test.com');
            expect(usuario.numeroTelefone).toBe(5511999999999);
            expect(usuario.idiomaPadrao).toBe('pt-BR');
            expect(usuario.status).toBe(STATUS.OFFLINE);
            expect(usuario.senha).toBeDefined();
            expect(usuario.senha).not.toBe('senha123'); // Deve estar hasheada
            expect(usuario._id).toBeDefined();
        });

        test('deve usar idioma padrão pt-BR quando não especificado', async () => {
            const dadosUsuario = {
                nome: 'Maria Santos',
                email: 'maria@test.com',
                senha: 'senha123'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);

            expect(usuario.idiomaPadrao).toBe('pt-BR');
        });

        test('deve falhar ao cadastrar usuário com email duplicado', async () => {
            const dadosUsuario = {
                nome: 'Primeiro Usuário',
                email: 'duplicado@test.com',
                senha: 'senha123'
            };

            await UsuarioService.cadastrar(dadosUsuario);

            const dadosUsuario2 = {
                nome: 'Segundo Usuário',
                email: 'duplicado@test.com',
                senha: 'senha456'
            };

            await expect(UsuarioService.cadastrar(dadosUsuario2))
                .rejects.toThrow('Email já cadastrado');
        });

        test('deve falhar ao cadastrar usuário com telefone duplicado', async () => {
            const dadosUsuario = {
                nome: 'Primeiro Usuário',
                email: 'primeiro@test.com',
                numeroTelefone: 5511888888888,
                senha: 'senha123'
            };

            await UsuarioService.cadastrar(dadosUsuario);

            const dadosUsuario2 = {
                nome: 'Segundo Usuário',
                email: 'segundo@test.com',
                numeroTelefone: 5511888888888,
                senha: 'senha456'
            };

            await expect(UsuarioService.cadastrar(dadosUsuario2))
                .rejects.toThrow('Número de telefone já cadastrado');
        });

        test('deve normalizar email e telefone', async () => {
            const dadosUsuario = {
                nome: 'Test User',
                email: 'TEST@EXAMPLE.COM',
                numeroTelefone: '(11) 99999-9999',
                senha: 'senha123'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);

            expect(usuario.email).toBe('test@example.com');
            expect(usuario.numeroTelefone).toBe('5511999999999');
        });
    });

    describe('Login de Usuário', () => {
        let userId;

        beforeEach(async () => {
            const dadosUsuario = {
                nome: 'Login User',
                email: 'login@test.com',
                senha: 'senha123'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);
            userId = usuario._id;
        });

        test('deve fazer login com sucesso', async () => {
            const usuario = await UsuarioService.login('login@test.com', 'senha123');

            expect(usuario).toBeDefined();
            expect(usuario.email).toBe('login@test.com');
            expect(usuario.status).toBe(STATUS.ONLINE); // Deve alterar para online
        });

        test('deve falhar com usuário inexistente', async () => {
            await expect(UsuarioService.login('inexistente@test.com', 'senha123'))
                .rejects.toThrow('Usuário não encontrado');
        });

        test('deve falhar com senha incorreta', async () => {
            await expect(UsuarioService.login('login@test.com', 'senhaerrada'))
                .rejects.toThrow('Senha inválida');
        });

        test('deve normalizar email no login', async () => {
            const usuario = await UsuarioService.login('LOGIN@TEST.COM', 'senha123');

            expect(usuario).toBeDefined();
            expect(usuario.email).toBe('login@test.com');
        });
    });

    describe('Alteração de Status', () => {
        let userId;

        beforeEach(async () => {
            const dadosUsuario = {
                nome: 'Status User',
                email: 'status@test.com',
                senha: 'senha123'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);
            userId = usuario._id;
        });

        test('deve alterar status para online', async () => {
            const usuario = await UsuarioService.alterarStatus(userId, STATUS.ONLINE);

            expect(usuario.status).toBe(STATUS.ONLINE);
        });

        test('deve alterar status para ocupado', async () => {
            const usuario = await UsuarioService.alterarStatus(userId, STATUS.OCUPADO);

            expect(usuario.status).toBe(STATUS.OCUPADO);
        });

        test('deve falhar com usuário inexistente', async () => {
            const fakeId = '507f1f77bcf86cd799439999';

            await expect(UsuarioService.alterarStatus(fakeId, STATUS.ONLINE))
                .rejects.toThrow('Usuário não encontrado');
        });
    });

    describe('Alteração de Idioma', () => {
        let userId;

        beforeEach(async () => {
            const dadosUsuario = {
                nome: 'Language User',
                email: 'lang@test.com',
                senha: 'senha123',
                idiomaPadrao: 'pt-BR'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);
            userId = usuario._id;
        });

        test('deve alterar idioma para inglês', async () => {
            const usuario = await UsuarioService.alterarIdioma(userId, 'en-US');

            expect(usuario.idiomaPadrao).toBe('en-US');
        });

        test('deve alterar idioma para espanhol', async () => {
            const usuario = await UsuarioService.alterarIdioma(userId, 'es-ES');

            expect(usuario.idiomaPadrao).toBe('es-ES');
        });

        test('deve falhar com idioma não suportado', async () => {
            await expect(UsuarioService.alterarIdioma(userId, 'ko-KR'))
                .rejects.toThrow('Idioma não suportado');
        });

        test('deve falhar com usuário inexistente', async () => {
            const fakeId = '507f1f77bcf86cd799439999';

            await expect(UsuarioService.alterarIdioma(fakeId, 'en-US'))
                .rejects.toThrow('Usuário não encontrado');
        });
    });

    describe('Busca de Usuários', () => {
        beforeEach(async () => {
            const usuarios = [
                { nome: 'Alice Silva', email: 'alice@test.com', numeroTelefone: 5511111111111, senha: 'senha123' },
                { nome: 'Bob Santos', email: 'bob@test.com', numeroTelefone: 5511222222222, senha: 'senha123' },
                { nome: 'Carlos Lima', email: 'carlos@test.com', senha: 'senha123' }
            ];

            for (const dadosUsuario of usuarios) {
                await UsuarioService.cadastrar(dadosUsuario);
            }
        });

        test('deve buscar usuário por email', async () => {
            const usuarios = await UsuarioService.buscarUsuarios({
                searchParams: { email: 'alice@test.com' }
            });

            expect(usuarios).toHaveLength(1);
            expect(usuarios[0].nome).toBe('Alice Silva');
            expect(usuarios[0].email).toBe('alice@test.com');
        });

        test('deve buscar usuário por telefone', async () => {
            const usuarios = await UsuarioService.buscarUsuarios({
                searchParams: { numeroTelefone: 5511111111111 }
            });

            expect(usuarios).toHaveLength(1);
            expect(usuarios[0].nome).toBe('Alice Silva');
        });

        test('deve buscar usuário por nome parcial', async () => {
            const usuarios = await UsuarioService.buscarUsuarios({
                searchParams: { nome: { $regex: 'Silva', $options: 'i' } }
            });

            expect(usuarios).toHaveLength(1);
            expect(usuarios[0].nome).toBe('Alice Silva');
        });

        test('deve retornar lista vazia quando não encontrar', async () => {
            const usuarios = await UsuarioService.buscarUsuarios({
                searchParams: { email: 'inexistente@test.com' }
            });

            expect(usuarios).toHaveLength(0);
        });

        test('deve falhar sem critérios de busca', async () => {
            await expect(UsuarioService.buscarUsuarios({}))
                .rejects.toThrow('Forneça pelo menos um critério: telefone, email ou nome');
        });

        test('deve aplicar limite e offset', async () => {
            const usuarios = await UsuarioService.buscarUsuarios({
                searchParams: {},
                limit: 2,
                offset: 1
            });

            expect(usuarios).toHaveLength(2);
        });
    });

    describe('Gerenciamento de Contatos', () => {
        let userId, contactId;

        beforeEach(async () => {
            const dadosUsuario = {
                nome: 'Main User',
                email: 'main@test.com',
                senha: 'senha123'
            };
            const usuario = await UsuarioService.cadastrar(dadosUsuario);
            userId = usuario._id;

            const dadosContato = {
                nome: 'Contact User',
                email: 'contact@test.com',
                senha: 'senha123'
            };
            const contato = await UsuarioService.cadastrar(dadosContato);
            contactId = contato._id;
        });

        test('deve adicionar contato por ID', async () => {
            const resultado = await UsuarioService.adicionarContato(userId, contactId, 'Amigo');

            expect(resultado).toBeDefined();
            expect(resultado.contatoId.toString()).toBe(contactId.toString());
            expect(resultado.apelido).toBe('Amigo');
            expect(resultado.contato.nome).toBe('Contact User');
        });

        test('deve adicionar contato por email', async () => {
            const resultado = await UsuarioService.adicionarContatoPorEmail(userId, 'contact@test.com', 'Amigo');

            expect(resultado).toBeDefined();
            expect(resultado.contato.email).toBe('contact@test.com');
            expect(resultado.apelido).toBe('Amigo');
        });

        test('deve adicionar contato por telefone', async () => {
            // Primeiro adicionar telefone ao contato
            // Atualiza o perfil do contato para incluir o número de telefone
            await UsuarioService.atualizarPerfil(contactId, { numeroTelefone: '5511999999999' });

            const resultado = await UsuarioService.adicionarContatoPorTelefone(userId, '5511999999999', 'Amigo');

            expect(resultado).toBeDefined();
            expect(resultado.apelido).toBe('Amigo');
        });

        test('deve impedir adicionar a si mesmo como contato', async () => {
            await expect(UsuarioService.adicionarContato(userId, userId))
                .rejects.toThrow('Você não pode adicionar a si mesmo como contato');
        });

        test('deve remover contato', async () => {
            await UsuarioService.adicionarContato(userId, contactId, 'Amigo');

            const resultado = await UsuarioService.removerContato(userId, contactId);

            expect(resultado.success).toBe(true);
        });

        test('deve listar contatos', async () => {
            await UsuarioService.adicionarContato(userId, contactId, 'Amigo');

            const contatos = await UsuarioService.listarContatos(userId);

            expect(contatos).toHaveLength(1);
            expect(contatos[0].apelido).toBe('Amigo');
            expect(contatos[0].contato.nome).toBe('Contact User');
        });

        test('deve editar apelido do contato', async () => {
            await UsuarioService.adicionarContato(userId, contactId, 'Apelido Antigo');

            const resultado = await UsuarioService.editarApelido(userId, contactId, 'Novo Apelido');

            expect(resultado.success).toBe(true);
        });
    });

    describe('Perfil do Usuário', () => {
        let userId;

        beforeEach(async () => {
            const dadosUsuario = {
                nome: 'Profile User',
                email: 'profile@test.com',
                senha: 'senha123'
            };

            const usuario = await UsuarioService.cadastrar(dadosUsuario);
            userId = usuario._id;
        });

        test('deve obter perfil do usuário', async () => {
            const perfil = await UsuarioService.obterPerfil(userId);

            expect(perfil).toBeDefined();
            expect(perfil.nome).toBe('Profile User');
            expect(perfil.email).toBe('profile@test.com');
        });

        test('deve atualizar perfil', async () => {
            const dadosAtualizacao = {
                nome: 'Nome Atualizado',
                status: STATUS.ONLINE
            };

            const perfilAtualizado = await UsuarioService.atualizarPerfil(userId, dadosAtualizacao);

            expect(perfilAtualizado.nome).toBe('Nome Atualizado');
            expect(perfilAtualizado.status).toBe(STATUS.ONLINE);
        });

        test('deve alterar senha', async () => {
            const resultado = await UsuarioService.alterarSenha(userId, 'senha123', 'novasenha456');

            expect(resultado.success).toBe(true);
            expect(resultado.message).toBe('Senha alterada com sucesso');
        });

        test('deve falhar ao alterar senha com senha atual incorreta', async () => {
            await expect(UsuarioService.alterarSenha(userId, 'senhaerrada', 'novasenha456'))
                .rejects.toThrow('Senha atual incorreta');
        });

        test('deve falhar ao alterar senha com nova senha muito curta', async () => {
            await expect(UsuarioService.alterarSenha(userId, 'senha123', '123'))
                .rejects.toThrow('A nova senha deve ter pelo menos 6 caracteres');
        });
    });
});
