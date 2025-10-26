const API_BASE_URL = 'http://localhost:8080';
let paginaAtual = 1;
const itensPorPagina = 10;
let totalExcecoes = 0;
let excecaoEditandoId = null;
let todasExcecoes = []; // Para armazenar todas as exceções carregadas

document.addEventListener('DOMContentLoaded', function () {
    if (!verificarAutenticacao()) return;

    // Carregar dados do usuário
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.nome) {
        const navbarUserName = document.getElementById('navbar-user-name');
        const dropdownUserName = document.getElementById('dropdown-user-name');

        if (navbarUserName) navbarUserName.textContent = userData.nome;
        if (dropdownUserName) dropdownUserName.textContent = userData.nome;
    }

    if (userData.role) {
        const dropdownUserRole = document.getElementById('dropdown-user-role');
        if (dropdownUserRole) dropdownUserRole.textContent = userData.role;
    }

    // Inicializar dashboard
    carregarConferencias();
    carregarRecebimentos();

    // Configurar eventos
    configurarEventos();
});

// Formatação de dados
function formatarData(dataString) {
    if (!dataString) return '-';
    
    try {
        const data = new Date(dataString);
        if (isNaN(data)) return dataString;
        
        return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR');
    } catch (e) {
        console.error('Erro ao formatar data:', e, dataString);
        return dataString;
    }
}

// ---------- Função genérica de fetch com token ----------
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return Promise.reject('Não autenticado');
    }

    const headers = new Headers({
        'Content-Type': 'application/json',
        ...(options.headers || {})
    });
    headers.set('Authorization', `Bearer ${token}`);

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 204) return { ok: true, data: null };

        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            console.warn('Token inválido ou expirado');
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            window.location.href = '/login.html';
            return { ok: false, data: { message: 'Não autorizado' } };
        }

        return { ok: response.ok, data };
    } catch (err) {
        console.error('Erro na requisição:', err);
        return { ok: false, data: { message: 'Erro de conexão' } };
    }
}

// Função de API corrigida
async function apiRequest(endpoint, options = {}) {
    try {
        const url = new URL(API_BASE_URL + endpoint);
        
        // Adicionar parâmetros de consulta se fornecidos
        if (options.query) {
            Object.entries(options.query).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, value);
                }
            });
        }

        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        // Adicionar corpo para métodos POST/PUT
        if (options.body && (options.method === 'POST' || options.method === 'PUT')) {
            config.body = JSON.stringify(options.body);
        }

        const { ok, data } = await apiFetch(url.toString(), config);

        if (!ok) {
            throw new Error(data.message || `Erro ${options.method || 'GET'} ${endpoint}`);
        }

        return data;
    } catch (error) {
        console.error('Erro na requisição API:', endpoint, error);
        throw error;
    }
}

function formatarMoeda(valor) {
    if (valor === null || valor === undefined || valor === '') return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function obterTextoGravidade(gravidade) {
    const gravidades = {
        'BAIXA': 'Baixa',
        'MEDIA': 'Média',
        'ALTA': 'Alta',
        'CRITICA': 'Crítica'
    };
    return gravidades[gravidade] || gravidade;
}

function obterTextoStatus(status) {
    const statusMap = {
        'ABERTA': 'Aberta',
        'EM_ANALISE': 'Em Análise',
        'AGUARDANDO_APROVACAO': 'Aguardando Aprovação',
        'RESOLVIDA': 'Resolvida',
        'ESCALONADA': 'Escalonada',
        'CANCELADA': 'Cancelada'
    };
    return statusMap[status] || status;
}

function obterClasseBadgeGravidade(gravidade) {
    const classes = {
        'BAIXA': 'badge-baixa',
        'MEDIA': 'badge-media',
        'ALTA': 'badge-alta',
        'CRITICA': 'badge-critica'
    };
    return classes[gravidade] || 'badge-secondary';
}

function obterClasseBadgeStatus(status) {
    const classes = {
        'ABERTA': 'badge-aberta',
        'EM_ANALISE': 'badge-em_analise',
        'AGUARDANDO_APROVACAO': 'badge-aguardando_aprovacao',
        'RESOLVIDA': 'badge-resolvida',
        'ESCALONADA': 'badge-escalonada',
        'CANCELADA': 'badge-cancelada'
    };
    return classes[status] || 'badge-secondary';
}

async function carregarExcecoes() {
    try {
        mostrarLoading(true);
        
        // Construir parâmetros de consulta
        const queryParams = {};
        
        const tipo = document.getElementById('filtro-tipo').value;
        const gravidade = document.getElementById('filtro-gravidade').value;
        const status = document.getElementById('filtro-status').value;
        const dataInicio = document.getElementById('filtro-data-inicio').value;
        const dataFim = document.getElementById('filtro-data-fim').value;
        
        if (tipo) queryParams.tipo = tipo;
        if (gravidade) queryParams.gravidade = gravidade;
        if (status) queryParams.status = status;
        if (dataInicio) queryParams.dataInicio = dataInicio;
        if (dataFim) queryParams.dataFim = dataFim;
        
        // Carregar exceções com filtros
        const excecoes = await apiRequest('/excecoes', {
            query: {
                page: paginaAtual,
                limit: itensPorPagina,
                ...queryParams
            }
        });
        
        todasExcecoes = excecoes;
        totalExcecoes = excecoes.length;
        
        // Paginação no cliente
        const inicio = (paginaAtual - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const excecoesPagina = excecoes.slice(inicio, fim);
        
        preencherTabelaExcecoes(excecoesPagina);
        atualizarPaginacao(excecoes.length);
        atualizarResumo(excecoes);
    } catch (error) {
        console.error('Erro ao carregar exceções:', error);
        document.getElementById('tabela-excecoes').innerHTML = 
            '<tr><td colspan="10" class="text-center text-danger">Erro ao carregar exceções: ' + error.message + '</td></tr>';
    } finally {
        mostrarLoading(false);
    }
}

async function carregarExcecaoPorId(id) {
    try {
        mostrarLoading(true);
        return await apiRequest(`/excecoes/${id}`);
    } catch (error) {
        console.error('Erro ao carregar exceção:', error);
        mostrarMensagem('Erro ao carregar dados da exceção', 'danger');
        throw error;
    } finally {
        mostrarLoading(false);
    }
}

async function criarExcecao(dados) {
    try {
        mostrarLoading(true);
        const resultado = await apiRequest('/excecoes', {
            method: 'POST',
            body: dados
        });
        
        mostrarMensagem('Exceção criada com sucesso!', 'success');
        return resultado;
    } catch (error) {
        console.error('Erro ao criar exceção:', error);
        mostrarMensagem('Erro ao criar exceção: ' + error.message, 'danger');
        throw error;
    } finally {
        mostrarLoading(false);
    }
}

async function atualizarExcecao(id, dados) {
    try {
        mostrarLoading(true);
        const resultado = await apiRequest(`/excecoes/${id}`, {
            method: 'PUT',
            body: dados
        });
        
        mostrarMensagem('Exceção atualizada com sucesso!', 'success');
        return resultado;
    } catch (error) {
        console.error('Erro ao atualizar exceção:', error);
        mostrarMensagem('Erro ao atualizar exceção: ' + error.message, 'danger');
        throw error;
    } finally {
        mostrarLoading(false);
    }
}

async function excluirExcecao(id) {
    try {
        mostrarLoading(true);
        await apiRequest(`/excecoes/${id}`, {
            method: 'DELETE'
        });
        
        mostrarMensagem('Exceção excluída com sucesso!', 'success');
        return true;
    } catch (error) {
        console.error('Erro ao excluir exceção:', error);
        mostrarMensagem('Erro ao excluir exceção: ' + error.message, 'danger');
        throw error;
    } finally {
        mostrarLoading(false);
    }
}

// Preenchimento de dados na UI
function preencherTabelaExcecoes(excecoes) {
    const tbody = document.getElementById('tabela-excecoes');
    
    if (!excecoes || excecoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">Nenhuma exceção encontrada</td></tr>';
        return;
    }
    
    tbody.innerHTML = excecoes.map(excecao => `
        <tr class="${excecao.reincidente ? 'reincidente' : ''}">
            <td>${excecao.numero_ocorrencia || excecao.id}</td>
            <td>${excecao.titulo}</td>
            <td>${excecao.tipo}</td>
            <td><span class="badge ${obterClasseBadgeGravidade(excecao.gravidade)}">${obterTextoGravidade(excecao.gravidade)}</span></td>
            <td><span class="badge ${obterClasseBadgeStatus(excecao.status)}">${obterTextoStatus(excecao.status)}</span></td>
            <td>${formatarData(excecao.data_ocorrencia)}</td>
            <td>${excecao.responsavel ? excecao.responsavel.nome : '-'}</td>
            <td>${formatarData(excecao.data_limite_resolucao)}</td>
            <td>${formatarMoeda(excecao.impacto_financeiro)}</td>
            <td class="table-actions">
                <div class="action-buttons">
                    <button class="btn btn-sm btn-info btn-view" data-id="${excecao.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-warning btn-edit" data-id="${excecao.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger btn-delete" data-id="${excecao.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Adicionar event listeners aos botões
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            abrirModalDetalhes(id);
        });
    });
    
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            abrirModalEdicao(id);
        });
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            confirmarExclusao(id);
        });
    });
}

function atualizarPaginacao(totalItens) {
    const totalPaginas = Math.ceil(totalItens / itensPorPagina);
    const paginacaoContainer = document.getElementById('excecoes-pagination-container');
    
    if (totalPaginas <= 1) {
        paginacaoContainer.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Botão anterior
    if (paginaAtual > 1) {
        html += `<button class="pagination-btn" onclick="mudarPagina(${paginaAtual - 1})">Anterior</button>`;
    } else {
        html += `<button class="pagination-btn" disabled>Anterior</button>`;
    }
    
    // Números das páginas
    for (let i = 1; i <= totalPaginas; i++) {
        if (i === paginaAtual) {
            html += `<button class="pagination-btn active" disabled>${i}</button>`;
        } else {
            html += `<button class="pagination-btn" onclick="mudarPagina(${i})">${i}</button>`;
        }
    }
    
    // Botão próximo
    if (paginaAtual < totalPaginas) {
        html += `<button class="pagination-btn" onclick="mudarPagina(${paginaAtual + 1})">Próxima</button>`;
    } else {
        html += `<button class="pagination-btn" disabled>Próxima</button>`;
    }
    
    paginacaoContainer.innerHTML = html;
}

function atualizarResumo(excecoes) {
    // Calcular totais com base nas exceções carregadas
    const abertas = excecoes.filter(e => e.status === 'ABERTA').length;
    const emAnalise = excecoes.filter(e => e.status === 'EM_ANALISE').length;
    const aguardandoAprovacao = excecoes.filter(e => e.status === 'AGUARDANDO_APROVACAO').length;
    const resolvidas = excecoes.filter(e => e.status === 'RESOLVIDA').length;
    
    document.getElementById('total-abertas').textContent = abertas;
    document.getElementById('total-analise').textContent = emAnalise;
    document.getElementById('total-aprovacao').textContent = aguardandoAprovacao;
    document.getElementById('total-resolvidas').textContent = resolvidas;
}

// Modal de detalhes
async function abrirModalDetalhes(id) {
    try {
        const excecao = await carregarExcecaoPorId(id);
        
        // Preencher os dados no modal
        document.getElementById('detalhe-numero').value = excecao.numero_ocorrencia || excecao.id;
        document.getElementById('detalhe-titulo').value = excecao.titulo;
        document.getElementById('detalhe-tipo').value = excecao.tipo;
        document.getElementById('detalhe-gravidade').value = obterTextoGravidade(excecao.gravidade);
        document.getElementById('detalhe-status').value = obterTextoStatus(excecao.status);
        document.getElementById('detalhe-data-ocorrencia').value = formatarData(excecao.data_ocorrencia);
        document.getElementById('detalhe-prazo').value = formatarData(excecao.data_limite_resolucao);
        document.getElementById('detalhe-prioridade').value = excecao.prioridade || 'Não definida';
        document.getElementById('detalhe-descricao').value = excecao.descricao;
        document.getElementById('detalhe-pedido').value = excecao.pedido_id ? `Pedido #${excecao.pedido_id}` : '-';
        document.getElementById('detalhe-transporte').value = excecao.transporte_id ? `Transporte #${excecao.transporte_id}` : '-';
        document.getElementById('detalhe-recebimento').value = excecao.recebimento_id ? `Recebimento #${excecao.recebimento_id}` : '-';
        document.getElementById('detalhe-setor').value = excecao.setor_origem || '-';
        document.getElementById('detalhe-impacto').value = formatarMoeda(excecao.impacto_financeiro);
        document.getElementById('detalhe-custo').value = formatarMoeda(excecao.custo_resolucao);
        document.getElementById('detalhe-reincidente').value = excecao.reincidente ? 'Sim' : 'Não';
        document.getElementById('detalhe-reincidencias').value = excecao.numero_reincidencias || 0;
        document.getElementById('detalhe-criador').value = excecao.criador_id ? `Usuário #${excecao.criador_id}` : '-';
        document.getElementById('detalhe-responsavel').value = excecao.responsavel_id ? `Usuário #${excecao.responsavel_id}` : '-';
        document.getElementById('detalhe-solucao').value = excecao.solucao_aplicada || '-';
        document.getElementById('detalhe-acoes').value = excecao.acoes_tomadas || '-';
        document.getElementById('detalhe-data-resolucao').value = formatarData(excecao.data_resolucao);
        
        // Preencher histórico
        const timeline = document.getElementById('timeline-historico');
        if (excecao.historico && excecao.historico.length > 0) {
            timeline.innerHTML = excecao.historico.map(entry => `
                <div class="timeline-item">
                    <div class="timeline-content">
                        <strong>${entry.usuario || 'Sistema'}</strong> - ${entry.acao || 'Modificação'}
                        <small class="text-muted">${formatarData(entry.timestamp || entry.data)}</small>
                    </div>
                </div>
            `).join('');
        } else {
            timeline.innerHTML = '<div class="text-center">Nenhum histórico disponível</div>';
        }
        
        // Configurar botão de edição
        document.getElementById('btn-editar').onclick = () => {
            $('#modal-detalhes').modal('hide');
            abrirModalEdicao(id);
        };
        
        // Abrir modal
        $('#modal-detalhes').modal('show');
    } catch (error) {
        console.error('Erro ao abrir modal de detalhes:', error);
    }
}

// Modal de edição
async function abrirModalEdicao(id) {
    try {
        excecaoEditandoId = id;
        const excecao = await carregarExcecaoPorId(id);
        
        // Preencher os dados no formulário de edição
        document.getElementById('numero-ocorrencia-edicao').textContent = excecao.numero_ocorrencia || excecao.id;
        document.getElementById('excecao-titulo-edicao').value = excecao.titulo;
        document.getElementById('excecao-tipo-edicao').value = excecao.tipo;
        document.getElementById('excecao-gravidade-edicao').value = excecao.gravidade;
        document.getElementById('excecao-descricao-edicao').value = excecao.descricao;
        document.getElementById('excecao-status-edicao').value = excecao.status;
        document.getElementById('excecao-prioridade-edicao').value = excecao.prioridade || 3;
        document.getElementById('excecao-setor-edicao').value = excecao.setor_origem || '';
        
        // Formatar datas para o input datetime-local
        const formatarDataParaInput = (dataString) => {
            if (!dataString) return '';
            const data = new Date(dataString);
            return data.toISOString().slice(0, 16);
        };
        
        document.getElementById('excecao-data-edicao').value = formatarDataParaInput(excecao.data_ocorrencia);
        document.getElementById('excecao-prazo-edicao').value = formatarDataParaInput(excecao.data_limite_resolucao);
        document.getElementById('excecao-processo-edicao').value = excecao.processo_afetado || '';
        document.getElementById('excecao-pedido-edicao').value = excecao.pedido_id || '';
        document.getElementById('excecao-transporte-edicao').value = excecao.transporte_id || '';
        document.getElementById('excecao-recebimento-edicao').value = excecao.recebimento_id || '';
        document.getElementById('excecao-criador-edicao').value = excecao.criador_id ? `Usuário #${excecao.criador_id}` : '';
        document.getElementById('excecao-responsavel-edicao').value = excecao.responsavel_id || '';
        document.getElementById('excecao-impacto-edicao').value = excecao.impacto_financeiro || '';
        document.getElementById('excecao-custo-edicao').value = excecao.custo_resolucao || '';
        document.getElementById('excecao-reincidente-edicao').checked = excecao.reincidente || false;
        document.getElementById('excecao-reincidencias-edicao').value = excecao.numero_reincidencias || 0;
        document.getElementById('excecao-tags-edicao').value = excecao.tags ? excecao.tags.join(', ') : '';
        document.getElementById('excecao-solucao-edicao').value = excecao.solucao_aplicada || '';
        document.getElementById('excecao-acoes-edicao').value = excecao.acoes_tomadas || '';
        document.getElementById('excecao-data-resolucao-edicao').value = formatarDataParaInput(excecao.data_resolucao);
        
        // Preencher lista de anexos
        const listaAnexos = document.getElementById('lista-anexos');
        if (excecao.anexos && excecao.anexos.length > 0) {
            listaAnexos.innerHTML = excecao.anexos.map(anexo => `
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span>${anexo.nome || anexo}</span>
                    <button class="btn btn-sm btn-danger" onclick="removerAnexo('${anexo.id || anexo}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
        } else {
            listaAnexos.innerHTML = '<p class="text-muted">Nenhum anexo</p>';
        }
        
        // Abrir modal
        $('#modal-edicao').modal('show');
    } catch (error) {
        console.error('Erro ao abrir modal de edição:', error);
    }
}

async function salvarExcecao() {
    try {
        const dados = {
            titulo: document.getElementById('excecao-titulo-edicao').value,
            tipo: document.getElementById('excecao-tipo-edicao').value,
            gravidade: document.getElementById('excecao-gravidade-edicao').value,
            descricao: document.getElementById('excecao-descricao-edicao').value,
            status: document.getElementById('excecao-status-edicao').value,
            prioridade: parseInt(document.getElementById('excecao-prioridade-edicao').value),
            setor_origem: document.getElementById('excecao-setor-edicao').value,
            data_ocorrencia: document.getElementById('excecao-data-edicao').value,
            data_limite_resolucao: document.getElementById('excecao-prazo-edicao').value,
            processo_afetado: document.getElementById('excecao-processo-edicao').value,
            pedido_id: document.getElementById('excecao-pedido-edicao').value || null,
            transporte_id: document.getElementById('excecao-transporte-edicao').value || null,
            recebimento_id: document.getElementById('excecao-recebimento-edicao').value || null,
            responsavel_id: document.getElementById('excecao-responsavel-edicao').value || null,
            impacto_financeiro: parseFloat(document.getElementById('excecao-impacto-edicao').value) || 0,
            custo_resolucao: parseFloat(document.getElementById('excecao-custo-edicao').value) || 0,
            reincidente: document.getElementById('excecao-reincidente-edicao').checked,
            numero_reincidencias: parseInt(document.getElementById('excecao-reincidencias-edicao').value) || 0,
            tags: document.getElementById('excecao-tags-edicao').value.split(',').map(tag => tag.trim()).filter(tag => tag !== ''),
            solucao_aplicada: document.getElementById('excecao-solucao-edicao').value,
            acoes_tomadas: document.getElementById('excecao-acoes-edicao').value,
            data_resolucao: document.getElementById('excecao-data-resolucao-edicao').value || null
        };

        await atualizarExcecao(excecaoEditandoId, dados);

        $('#modal-edicao').modal('hide');
        carregarExcecoes();
    } catch (error) {
        console.error('Erro ao salvar exceção:', error);
        mostrarMensagem('Erro ao salvar exceção: ' + error.message, 'danger');
    }
}

// Modal de nova exceção
function abrirModalNovaExcecao() {
    // Limpar formulário
    document.getElementById('form-nova-excecao').reset();
    
    // Definir data atual como padrão
    const agora = new Date();
    document.getElementById('excecao-data').value = agora.toISOString().slice(0, 16);
    
    // Abrir modal
    $('#modal-nova-excecao').modal('show');
}

async function criarNovaExcecao() {
    try {
        const dados = {
            titulo: document.getElementById('excecao-titulo').value,
            tipo: document.getElementById('excecao-tipo').value,
            gravidade: document.getElementById('excecao-gravidade').value,
            descricao: document.getElementById('excecao-descricao').value,
            data_ocorrencia: document.getElementById('excecao-data').value,
            data_limite_resolucao: document.getElementById('excecao-prazo').value,
            pedido_id: document.getElementById('excecao-pedido').value || null,
            transporte_id: document.getElementById('excecao-transporte').value || null,
            recebimento_id: document.getElementById('excecao-recebimento').value || null,
            impacto_financeiro: parseFloat(document.getElementById('excecao-impacto').value) || 0,
            setor_origem: document.getElementById('excecao-setor').value
        };
        
        await criarExcecao(dados);
        
        $('#modal-nova-excecao').modal('hide');
        carregarExcecoes();
    } catch (error) {
        console.error('Erro ao criar nova exceção:', error);
        mostrarMensagem('Erro ao criar exceção: ' + error.message, 'danger');
    }
}

// Confirmação de exclusão
async function confirmarExclusao(id) {
    if (confirm('Tem certeza que deseja excluir esta exceção?')) {
        try {
            await excluirExcecao(id);
            carregarExcecoes();
        } catch (error) {
            console.error('Erro ao excluir exceção:', error);
            mostrarMensagem('Erro ao excluir exceção: ' + error.message, 'danger');
        }
    }
}

// Filtros
function aplicarFiltros() {
    paginaAtual = 1;
    carregarExcecoes();
}

function mudarPagina(pagina) {
    paginaAtual = pagina;
    carregarExcecoes();
}

function filtrarPorStatus(status) {
    document.getElementById('filtro-status').value = status;
    aplicarFiltros();
}

function buscarExcecoes() {
    const termo = document.getElementById('input-busca').value.toLowerCase();
    
    // Filtro de busca no cliente
    const rows = document.querySelectorAll('#tabela-excecoes tr');
    let encontradas = 0;
    
    rows.forEach(row => {
        const texto = row.textContent.toLowerCase();
        if (texto.includes(termo)) {
            row.style.display = '';
            encontradas++;
        } else {
            row.style.display = 'none';
        }
    });
    
    if (encontradas === 0) {
        document.getElementById('tabela-excecoes').innerHTML = 
            '<tr><td colspan="10" class="text-center">Nenhuma exceção encontrada</td></tr>';
    }
}

// Utilitários
function mostrarLoading(mostrar) {
    document.getElementById('loading-spinner').style.display = mostrar ? 'block' : 'none';
}

function mostrarMensagem(mensagem, tipo) {
    // Criar toast message
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo} mb-2`;
    toast.innerHTML = `
        <div class="toast-body">
            <button type="button" class="close" data-dismiss="toast">&times;</button>
            ${mensagem}
        </div>
    `;
    
    document.getElementById('toast-container').appendChild(toast);
    
    // Inicializar e mostrar o toast
    $(toast).toast({ delay: 3000 });
    $(toast).toast('show');
    
    // Remover o toast após ser escondido
    $(toast).on('hidden.bs.toast', function () {
        toast.remove();
    });
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Carregar dados iniciais
    carregarExcecoes();
    
    // Configurar event listeners
    document.getElementById('filtro-tipo').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-gravidade').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-status').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-data-inicio').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-data-fim').addEventListener('change', aplicarFiltros);
    
    document.getElementById('btn-salvar-excecao').addEventListener('click', salvarExcecao);
    document.getElementById('btn-criar-excecao').addEventListener('click', criarNovaExcecao);
    
    // Configurar busca em tempo real
    let timeoutBusca;
    document.getElementById('input-busca').addEventListener('input', function() {
        clearTimeout(timeoutBusca);
        timeoutBusca = setTimeout(buscarExcecoes, 300);
    });
    
    // Configurar file input
    document.getElementById('excecao-anexos-edicao').addEventListener('change', function(e) {
        const files = e.target.files;
        if (files.length > 0) {
            const label = document.querySelector('[for="excecao-anexos-edicao"]');
            label.textContent = `${files.length} arquivo(s) selecionado(s)`;
        }
    });
});

// Funções globais para uso em HTML
window.filtrarPorStatus = filtrarPorStatus;
window.aplicarFiltros = aplicarFiltros;
window.mudarPagina = mudarPagina;
window.buscarExcecoes = buscarExcecoes;
window.abrirModalNovaExcecao = abrirModalNovaExcecao;
window.carregarExcecoes = carregarExcecoes;