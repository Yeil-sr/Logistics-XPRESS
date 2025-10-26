const API_BASE_URL = 'http://localhost:8080';
const PAGE_SIZE = 10;

// Mapeamento de status
const STATUS_PEDIDO = {
    'PENDENTE': { class: 'badge-pendente', text: 'Pendente' },
    'PROCESSANDO': { class: 'badge-processando', text: 'Processando' },
    'EM_ROTA': { class: 'badge-em-rota', text: 'Em Rota' },
    'ENTREGUE': { class: 'badge-entregue', text: 'Entregue' },
    'CANCELADO': { class: 'badge-cancelado', text: 'Cancelado' }
};

// Estado global
let pedidosData = [];
let pedidosCurrentPage = 1;
let pedidosTotalPages = 1;
let clientes = [];
let produtos = [];
let filtrosAtuais = {};
let contadoresTotais = {
    PENDENTE: 0,
    PROCESSANDO: 0,
    EM_ROTA: 0,
    ENTREGUE: 0,
    CANCELADO: 0
};

// Modal rastreamento pagination state
let rastreamentosData = [];
let rastreamentosPage = 1;
let rastreamentosTotalPages = 1;
let pedidoDetalhado = null;

// ---------- Funções de autenticação ----------
function verificarAutenticacao() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
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

// ---------- Helper genérico ----------
// Função base para todas as requisições
async function apiRequest(path, method = 'GET', data = null, query = null) {
    try {
        const url = new URL(API_BASE_URL + path);
        if (query && typeof query === 'object') {
            Object.entries(query).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') url.searchParams.append(k, v);
            });
        }

        const options = { method };
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH'))
            options.body = JSON.stringify(data);

        const { ok, data: responseData } = await apiFetch(url.toString(), options);

        if (!ok) throw new Error(responseData.message || 'Erro desconhecido');

        return responseData;
    } catch (err) {
        console.error('API request error:', path, err);
        throw err;
    }
}

// --- API helpers padronizados ---
async function apiGet(path, query = {}) {
    return apiRequest(path, 'GET', null, query);
}

async function apiPost(path, body) {
    return apiRequest(path, 'POST', body);
}

async function apiPut(path, body) {
    return apiRequest(path, 'PUT', body);
}

async function apiPatch(path, body) {
    return apiRequest(path, 'PATCH', body);
}

async function apiDelete(path) {
    return apiRequest(path, 'DELETE');
}

// Função apiFetch que inclui o token
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
        }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    const data = await response.json().catch(() => ({}));

    return {
        ok: response.ok,
        status: response.status,
        data
    };
}
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
// --- Utilitários ---
function formatarData(dataString) {
    if (!dataString) return '-';
    const d = new Date(dataString);
    if (isNaN(d)) return dataString;
    return d.toLocaleString('pt-BR');
}

function formatarMoeda(valor) {
    if (valor == null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function mostrarCarregamento(mostrar) {
    if (mostrar) {
        $('#loading-spinner').show();
    } else {
        $('#loading-spinner').hide();
    }
}

// --- Carregamento de dados iniciais ---
async function carregarDadosIniciais() {
    try {
        mostrarCarregamento(true);
        
        // Carregar clientes e produtos
        [clientes, produtos] = await Promise.all([
            apiRequest('/clientes'),
            apiRequest('/produtos')
        ]);
        
        popularSelectClientes();
        popularSelectProdutos();
        
        // Carregar pedidos e contadores totais
        await carregarPedidos({}, 1);
        await carregarContadoresTotais({});
        
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        alert('Erro ao carregar dados iniciais');
    } finally {
        mostrarCarregamento(false);
    }
}

function popularSelectClientes() {
    const selects = ['#pedido-cliente', '#editar-pedido-cliente', '#filtro-cliente'];
    
    selects.forEach(selectId => {
        const $select = $(selectId);
        $select.empty();
        $select.append('<option value="">Todos os clientes</option>');
        
        clientes.forEach(cliente => {
            $select.append(`<option value="${cliente.id}">${cliente.nome}</option>`);
        });
    });
}

function popularSelectProdutos() {
    const selects = ['#pedido-produto', '#editar-pedido-produto'];
    
    selects.forEach(selectId => {
        const $select = $(selectId);
        $select.empty();
        $select.append('<option value="">Selecione o produto</option>');
        
        produtos.forEach(produto => {
            $select.append(`<option value="${produto.id}">${produto.nome} - ${formatarMoeda(produto.preco)}</option>`);
        });
    });
}

// --- Carregar contadores totais ---
async function carregarContadoresTotais(filtros = {}) {
    try {
        const params = { ...filtros };

        if (params.termoBusca) {
            params.search = params.termoBusca;
            delete params.termoBusca;
        }

        Object.keys(params).forEach(key => {
            if (params[key] === '' || params[key] === null || params[key] === undefined) {
                delete params[key];
            }
        });

        const contadores = await apiRequest('/pedidos/contadores', 'GET', null, params);
        
        $('#total-pendentes').text(contadores.PENDENTE || 0);
        $('#total-processando').text(contadores.PROCESSANDO || 0);
        $('#total-em-rota').text(contadores.EM_ROTA || 0);
        $('#total-entregues').text(contadores.ENTREGUE || 0);
        
    } catch (error) {
        console.error('Erro ao carregar contadores totais:', error);
    }
}

// --- Carregamento / paginação de pedidos ---
async function carregarPedidos(filtros = {}, page = 1) {
    try {
        mostrarCarregamento(true);
        filtrosAtuais = { ...filtros };

        const pageSize = $('#filtro-limit').val() || PAGE_SIZE;
        const params = { ...filtros, page, size: pageSize };

        if (filtros.termoBusca) {
            params.search = filtros.termoBusca;
            delete params.termoBusca;
        }

        Object.keys(params).forEach(key => {
            if (params[key] === '' || params[key] === null || params[key] === undefined) {
                delete params[key];
            }
        });

        const response = await apiRequest('/pedidos', 'GET', null, params);
        
        if (response.pedidos !== undefined) {
            pedidosData = Array.isArray(response.pedidos) ? response.pedidos : [];
            pedidosTotalPages = response.totalPages || 1;
            pedidosCurrentPage = response.currentPage || page;
        } else {
            pedidosData = Array.isArray(response) ? response : [];
            const totalItems = pedidosData.length;
            pedidosTotalPages = Math.max(1, Math.ceil(totalItems / pageSize));
            pedidosCurrentPage = page;
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            pedidosData = pedidosData.slice(startIndex, endIndex);
        }

        renderizarPedidosPagina();
        carregarContadoresTotais(filtros);
        
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        $('#tabela-pedidos').html('<tr><td colspan="10" class="text-center text-danger">Erro ao carregar dados</td></tr>');
    } finally {
        mostrarCarregamento(false);
    }
}

function renderizarPedidosPagina() {
    const tbody = $('#tabela-pedidos');
    tbody.empty();

    if (!Array.isArray(pedidosData) || pedidosData.length === 0) {
        tbody.html('<tr><td colspan="10" class="text-center">Nenhum pedido encontrado</td></tr>');
        renderPaginationPedidos();
        return;
    }

    pedidosData.forEach(pedido => {
        const status = STATUS_PEDIDO[pedido.status] || { class: '', text: pedido.status || '-' };
        const temAssociacao = pedido.recebimento_id || pedido.transferencia_id || pedido.conferencia_id;
        
        const tr = $(`
            <tr data-id="${pedido.id}" class="${temAssociacao ? 'pedido-item associado' : ''}">
                <td>${pedido.codigo_pedido || pedido.id}</td>
                <td>${pedido.cliente?.nome || '-'}</td>
                <td>${pedido.produto?.nome || '-'}</td>
                <td>${pedido.quantidade || '-'}</td>
                <td>${pedido.valor_total != null ? formatarMoeda(pedido.valor_total) : '-'}</td>
                <td><span class="badge ${status.class}">${status.text}</span></td>
                <td>
                    ${temAssociacao ? `
                    <span class="badge badge-associado">Associado</span>
                    <div class="associacao-info">
                        ${pedido.recebimento_id ? `Recebimento: ${pedido.recebimento_id}` : ''}
                        ${pedido.transferencia_id ? `Transferência: ${pedido.transferencia_id}` : ''}
                        ${pedido.conferencia_id ? `Conferência: ${pedido.conferencia_id}` : ''}
                    </div>
                    ` : '<span class="text-muted">Nenhuma</span>'}
                </td>
                <td>${pedido.data_criacao ? formatarData(pedido.data_criacao) : '-'}</td>
                <td>${pedido.data_atualizacao ? formatarData(pedido.data_atualizacao) : '-'}</td>
                <td class="table-actions">
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-info btn-view" data-id="${pedido.id}" title="Ver">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-warning btn-edit" data-id="${pedido.id}" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger btn-delete" data-id="${pedido.id}" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `);
        
        tbody.append(tr);
    });

    renderPaginationPedidos();
}

function renderPaginationPedidos() {
    const $container = $('#pedidos-pagination-container');
    $container.empty();

    const total = pedidosTotalPages;
    const current = pedidosCurrentPage;

    if (total <= 1) return;

    // Botão anterior
    const $prev = $(`<button class="btn btn-sm btn-light mr-1" ${current === 1 ? 'disabled' : ''}>«</button>`);
    $prev.on('click', () => { if (current > 1) carregarPedidos(filtrosAtuais, current - 1); });
    $container.append($prev);

    // Páginas (mostrar até 7)
    const maxShow = 7;
    let start = 1, end = total;
    if (total > maxShow) {
        const half = Math.floor(maxShow / 2);
        start = Math.max(1, current - half);
        end = Math.min(total, start + maxShow - 1);
        if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);
    }
    
    for (let p = start; p <= end; p++) {
        const $btn = $(`<button class="btn btn-sm ${p === current ? 'btn-primary' : 'btn-outline-secondary'} mr-1">${p}</button>`);
        $btn.on('click', () => carregarPedidos(filtrosAtuais, p));
        $container.append($btn);
    }

    // Botão próximo
    const $next = $(`<button class="btn btn-sm btn-light" ${current === total ? 'disabled' : ''}>»</button>`);
    $next.on('click', () => { if (current < total) carregarPedidos(filtrosAtuais, current + 1); });
    $container.append($next);
}

// --- Cards resumo ---
function atualizarCardsResumo() {
    $('#total-pendentes').text(contadoresTotais.PENDENTE);
    $('#total-processando').text(contadoresTotais.PROCESSANDO);
    $('#total-em-rota').text(contadoresTotais.EM_ROTA);
    $('#total-entregues').text(contadoresTotais.ENTREGUE);
}

// --- Buscar / Filtrar ---
function filtrarPorStatus(status) {
    $('#filtro-status').val(status);
    aplicarFiltros();
}

function aplicarFiltros() {
    const filtros = {
        status: $('#filtro-status').val(),
        cliente_id: $('#filtro-cliente').val(),
        data_inicio: $('#filtro-data-inicio').val(),
        data_fim: $('#filtro-data-fim').val(),
        termoBusca: $('#input-busca').val().trim()
    };
    
    // Remover filtros vazios
    Object.keys(filtros).forEach(key => {
        if (!filtros[key]) delete filtros[key];
    });
    
    carregarPedidos(filtros, 1);
}

function limparFiltros() {
    $('#filtro-status').val('');
    $('#filtro-cliente').val('');
    $('#filtro-data-inicio').val('');
    $('#filtro-data-fim').val('');
    $('#input-busca').val('');
    
    aplicarFiltros();
}

function buscarPedidos() {
    aplicarFiltros();
}

// --- CRUD: criar, editar, excluir ---
async function criarPedido() {
    const formData = {
        codigo_pedido: $('#pedido-codigo').val(),
        cliente_id: $('#pedido-cliente').val(),
        produto_id: $('#pedido-produto').val(),
        endereco_id: $('#pedido-endereco').val(),
        quantidade: parseInt($('#pedido-quantidade').val()),
        valor_unitario: parseFloat($('#pedido-valor-unitario').val()),
        status: $('#pedido-status').val() || 'PENDENTE',
        transporte_id: $('#pedido-transporte').val() || null,
        observacoes: $('#pedido-observacoes').val()
    };

    if (!formData.codigo_pedido || !formData.cliente_id || !formData.produto_id || !formData.endereco_id) {
        alert('Preencha todos os campos obrigatórios corretamente');
        return;
    }

    try {
        mostrarCarregamento(true);
        await apiRequest('/pedidos/', 'POST', formData);
        $('#modal-novo-pedido').modal('hide');
        $('#form-pedido')[0].reset();
        await carregarPedidos(filtrosAtuais, 1);
        await carregarContadoresTotais({});
        alert('Pedido criado com sucesso!');
    } catch (error) {
        console.error('Erro ao criar pedido:', error);
        alert('Erro ao criar pedido');
    } finally {
        mostrarCarregamento(false);
    }
}

async function abrirEdicaoPedido(pedidoId) {
    try {
        mostrarCarregamento(true);
        const pedido = await apiGet(`/pedidos/${pedidoId}`);

        $('#editar-pedido-id').val(pedido.id);
        $('#editar-pedido-codigo').val(pedido.codigo_pedido || '');
        $('#editar-pedido-cliente').val(pedido.cliente_id);
        $('#editar-pedido-produto').val(pedido.produto_id);
        $('#editar-pedido-endereco').val(pedido.endereco_id || '');
        $('#editar-pedido-quantidade').val(pedido.quantidade);
        $('#editar-pedido-valor-unitario').val(pedido.valor_unitario);
        $('#editar-pedido-valor-total').val((pedido.quantidade * pedido.valor_unitario).toFixed(2));
        $('#editar-pedido-status').val(pedido.status);
        $('#editar-pedido-transporte').val(pedido.transporte_id || '');
        $('#editar-pedido-transferencia').val(pedido.transferencia_id || '');
        $('#editar-pedido-recebimento').val(pedido.recebimento_id || '');
        $('#editar-pedido-conferencia').val(pedido.conferencia_id || '');
        $('#editar-pedido-observacoes').val(pedido.observacoes || '');

        $('#modal-editar-pedido').modal('show');
    } catch (error) {
        console.error('Erro ao carregar pedido para edição:', error);
        alert('Erro ao carregar pedido');
    } finally {
        mostrarCarregamento(false);
    }
}

async function salvarEdicaoPedido() {
    const formData = {
        codigo_pedido: $('#editar-pedido-codigo').val(),
        cliente_id: $('#editar-pedido-cliente').val(),
        produto_id: $('#editar-pedido-produto').val(),
        endereco_id: $('#editar-pedido-endereco').val(),
        quantidade: parseInt($('#editar-pedido-quantidade').val()),
        valor_unitario: parseFloat($('#editar-pedido-valor-unitario').val()),
        status: $('#editar-pedido-status').val(),
        transporte_id: $('#transporte_id').val() || null,
        transferencia_id: $('#transferencia_id').val() || null,
        recebimento_id: $('#recebimento_id').val() || null,
        conferencia_id: $('#conferencia_id').val() || null,
        observacoes: $('#editar-pedido-observacoes').val()
    };

    if (!formData.codigo_pedido || !formData.cliente_id || !formData.produto_id || !formData.endereco_id) {
        alert('Preencha todos os campos obrigatórios corretamente');
        return;
    }

    try {
        mostrarCarregamento(true);
        const pedidoId = $('#editar-pedido-id').val();
        await apiRequest(`/pedidos/${pedidoId}`, 'PUT', formData);
        $('#modal-editar-pedido').modal('hide');
        await carregarPedidos(filtrosAtuais, pedidosCurrentPage);
        await carregarContadoresTotais({});
        alert('Pedido atualizado com sucesso!');
    } catch (error) {
        console.error('Erro ao atualizar pedido:', error);
        alert('Erro ao atualizar pedido');
    } finally {
        mostrarCarregamento(false);
    }
}

async function excluirPedido(pedidoId) {
    if (!confirm('Deseja realmente excluir este pedido?')) return;
    
    try {
        mostrarCarregamento(true);
        await apiRequest(`/pedidos/${pedidoId}`, 'DELETE');
        await carregarPedidos(filtrosAtuais, pedidosCurrentPage);
        await carregarContadoresTotais({});
        alert('Pedido excluído com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir pedido:', error);
        alert('Erro ao excluir pedido');
    } finally {
        mostrarCarregamento(false);
    }
}

// --- Ver detalhes e rastreamentos ---
async function verDetalhesPedido(pedidoId) {
    try {
        mostrarCarregamento(true);
        
        const [pedido, rastreamentos] = await Promise.all([
            apiGet(`/pedidos/${pedidoId}`),
            apiGet(`/pedidos/${pedidoId}/rastreamento`)
        ]);
        
        pedidoDetalhado = pedido;
        const status = STATUS_PEDIDO[pedido.status] || { class: '', text: pedido.status || '-' };

        // Preencher detalhes básicos
        $('#detalhe-id').val(pedido.codigo_pedido || pedido.id);
        $('#detalhe-cliente').val(pedido.cliente?.nome || '-');
        $('#detalhe-produto').val(pedido.produto?.nome || '-');
        $('#detalhe-valor').val(pedido.valor_total != null ? formatarMoeda(pedido.valor_total) : '-');
        $('#detalhe-status').val(status.text);
        $('#detalhe-criacao').val(pedido.data_criacao ? formatarData(pedido.data_criacao) : '-');
        $('#detalhe-atualizacao').val(pedido.data_atualizacao ? formatarData(pedido.data_atualizacao) : '-');

        const endereco = pedido.endereco_entrega ? 
            `${pedido.endereco_entrega}` : 
            'Endereço não informado';
        $('#detalhe-endereco').val(endereco);

        $('#detalhe-nota-fiscal').val(pedido.nota_fiscal || '-');
        $('#detalhe-codigo-rastreamento').val(pedido.codigo_rastreamento || '-');
        $('#detalhe-transportadora').val(pedido.transportadora || '-');
        $('#detalhe-previsao').val(pedido.previsao_entrega ? formatarData(pedido.previsao_entrega) : '-');

        // Rastreamentos
        rastreamentosData = Array.isArray(rastreamentos) ? rastreamentos : [];
        rastreamentosTotalPages = Math.max(1, Math.ceil(rastreamentosData.length / PAGE_SIZE));
        rastreamentosPage = 1;
        renderRastreamentosPage(rastreamentosPage);

        // Associações
        renderAssociacoes(pedido);

        configurarBotoesAcao(pedido);

        $('#modal-detalhes').modal('show');
        
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        alert('Erro ao carregar detalhes do pedido');
    } finally {
        mostrarCarregamento(false);
    }
}

function renderRastreamentosPage(page = 1) {
    const $container = $('#timeline-rastreamento');
    $container.empty();

    if (!Array.isArray(rastreamentosData) || rastreamentosData.length === 0) {
        $container.html('<div class="timeline-item">Nenhum histórico de rastreamento encontrado</div>');
        $('#rastreamento-pagination-container').empty();
        return;
    }

    rastreamentosTotalPages = Math.max(1, Math.ceil(rastreamentosData.length / PAGE_SIZE));
    rastreamentosPage = Math.min(Math.max(1, page), rastreamentosTotalPages);

    const start = (rastreamentosPage - 1) * PAGE_SIZE;
    const slice = rastreamentosData.slice(start, start + PAGE_SIZE);

    slice.forEach(r => {
        const classe = r.status === 'ENTREGUE' ? 'entregue' :
            r.status === 'CANCELADO' ? 'cancelado' :
            r.status === 'EM_ROTA' ? 'rota' : '';

        const html = `
            <div class="timeline-item ${classe}">
                <strong>${r.status}</strong><br>
                <small>${r.data_status ? formatarData(r.data_status) : '-'}</small><br>
                <small>${r.localizacao || ''}</small>
                ${r.observacao ? `<br><small>${r.observacao}</small>` : ''}
            </div>
        `;
        $container.append(html);
    });

    renderPaginationRastreamentos();
}

function renderPaginationRastreamentos() {
    const $container = $('#rastreamento-pagination-container');
    $container.empty();

    const total = rastreamentosTotalPages;
    const current = rastreamentosPage;

    if (total <= 1) return;

    const $prev = $(`<button class="btn btn-sm btn-light mr-1" ${current === 1 ? 'disabled' : ''}>«</button>`);
    $prev.on('click', () => { if (current > 1) renderRastreamentosPage(current - 1); });
    $container.append($prev);

    const maxShow = 5;
    let start = 1, end = total;
    if (total > maxShow) {
        const half = Math.floor(maxShow / 2);
        start = Math.max(1, current - half);
        end = Math.min(total, start + maxShow - 1);
        if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);
    }

    for (let p = start; p <= end; p++) {
        const $btn = $(`<button class="btn btn-sm ${p === current ? 'btn-primary' : 'btn-outline-secondary'} mr-1">${p}</button>`);
        $btn.on('click', () => renderRastreamentosPage(p));
        $container.append($btn);
    }

    const $next = $(`<button class="btn btn-sm btn-light" ${current === total ? 'disabled' : ''}>»</button>`);
    $next.on('click', () => { if (current < total) renderRastreamentosPage(current + 1); });
    $container.append($next);
}

function renderAssociacoes(pedido) {
    const $container = $('#associacoes-container');
    $container.empty();

    if (!pedido || (!pedido.recebimento_id && !pedido.transferencia_id && !pedido.conferencia_id)) {
        $container.html('<p class="text-muted">Nenhuma associação encontrada</p>');
        return;
    }

    let html = '';
    
    if (pedido.recebimento_id) {
        html += `
            <div class="alert alert-info">
                <h6><i class="fas fa-inbox"></i> Recebimento</h6>
                <p><strong>ID:</strong> ${pedido.recebimento_id}</p>
                <button class="btn btn-sm btn-outline-danger" onclick="removerAssociacao('recebimento', ${pedido.recebimento_id}, ${pedido.id})">
                    <i class="fas fa-unlink"></i> Remover Associação
                </button>
            </div>
        `;
    }
    
    if (pedido.transferencia_id) {
        html += `
            <div class="alert alert-warning">
                <h6><i class="fas fa-exchange-alt"></i> Transferência</h6>
                <p><strong>ID:</strong> ${pedido.transferencia_id}</p>
                <button class="btn btn-sm btn-outline-danger" onclick="removerAssociacao('transferencia', ${pedido.transferencia_id}, ${pedido.id})">
                    <i class="fas fa-unlink"></i> Remover Associação
                </button>
            </div>
        `;
    }
    
    if (pedido.conferencia_id) {
        html += `
            <div class="alert alert-success">
                <h6><i class="fas fa-clipboard-check"></i> Conferência</h6>
                <p><strong>ID:</strong> ${pedido.conferencia_id}</p>
                <button class="btn btn-sm btn-outline-danger" onclick="removerAssociacao('conferencia', ${pedido.conferencia_id}, ${pedido.id})">
                    <i class="fas fa-unlink"></i> Remover Associação
                </button>
            </div>
        `;
    }
    
    $container.html(html);
}

// --- Associação com operações ---
async function abrirModalAssociarOperacao() {
    try {
        mostrarCarregamento(true);
        
        // Carregar operações disponíveis
        const [recebimentos, transferencias, conferencias] = await Promise.all([
            apiGet('/recebimentos?status=EM_ANDAMENTO'),
            apiGet('/transferencias?status=EM_ANDAMENTO'),
            apiGet('/conferencias?status=EM_ANDAMENTO')
        ]);
        
        window.operacoesDisponiveis = {
            recebimento: recebimentos,
            transferencia: transferencias,
            conferencia: conferencias
        };
        
        $('#associar-pedido-id').val(pedidoDetalhado.id);
        $('#tipo-operacao').val('');
        $('#operacao-id').empty().prop('disabled', true);
        
        $('#modal-associar-operacao').modal('show');
        
    } catch (error) {
        console.error('Erro ao carregar operações:', error);
        alert('Erro ao carregar operações disponíveis');
    } finally {
        mostrarCarregamento(false);
    }
}

function popularOperacoesPorTipo(tipo) {
    const $select = $('#operacao-id');
    $select.empty().append('<option value="">Selecione a operação</option>');
    
    if (!tipo || !window.operacoesDisponiveis || !window.operacoesDisponiveis[tipo]) {
        $select.prop('disabled', true);
        return;
    }
    
    window.operacoesDisponiveis[tipo].forEach(operacao => {
        const identificador = operacao.numero_manifesto || operacao.numero || operacao.id;
        $select.append(`<option value="${operacao.id}">${identificador} - ${operacao.status}</option>`);
    });
    
    $select.prop('disabled', false);
}

// --- Associação com operações ---
async function associarOperacao() {
    const pedidoId = $('#associar-pedido-id').val();
    const tipo = $('#tipo-operacao').val();
    const operacaoId = $('#operacao-id').val();

    if (!pedidoId || !tipo || !operacaoId) {
        alert('Selecione todos os campos obrigatórios');
        return;
    }

    try {
        mostrarCarregamento(true);

        let endpoint;
        if (tipo === 'recebimento') {
            endpoint = `/pedidos/recebimentos/${operacaoId}/associar-pedido`;
        } else if (tipo === 'transferencia') {
            endpoint = `/pedidos/transferencias/${operacaoId}/associar-pedido`;
        } else if (tipo === 'conferencia') {
            endpoint = `/pedidos/conferencias/${operacaoId}/associar-pedido`;
        } else {
            alert('Tipo de operação inválido');
            return;
        }

        await apiPost(endpoint, { pedidoId: pedidoId });

        $('#modal-associar-operacao').modal('hide');
        alert('Pedido associado com sucesso!');

        // Recarregar detalhes do pedido
        await verDetalhesPedido(pedidoId);

    } catch (error) {
        console.error('Erro ao associar pedido:', error);
        alert('Erro ao associar pedido à operação');
    } finally {
        mostrarCarregamento(false);
    }
}

async function removerAssociacao(tipo, operacaoId, pedidoId) {
    if (!confirm('Deseja remover esta associação?')) return;

    try {
        mostrarCarregamento(true);

        let endpoint;
        if (tipo === 'recebimento') {
            endpoint = `/pedidos/recebimentos/${operacaoId}/remover-pedido/${pedidoId}`;
        } else if (tipo === 'transferencia') {
            endpoint = `/pedidos/transferencias/${operacaoId}/remover-pedido/${pedidoId}`;
        } else if (tipo === 'conferencia') {
            endpoint = `/pedidos/conferencias/${operacaoId}/remover-pedido/${pedidoId}`;
        } else {
            alert('Tipo de operação inválido');
            return;
        }

        await apiRequest(endpoint, 'DELETE');
        alert('Associação removida com sucesso!');

        // Recarregar detalhes do pedido
        await verDetalhesPedido(pedidoId);

    } catch (error) {
        console.error('Erro ao remover associação:', error);
        alert('Erro ao remover associação');
    } finally {
        mostrarCarregamento(false);
    }
}

// --- Ações no modal (botões) ---
function configurarBotoesAcao(pedido) {
    $('#btn-imprimir').off('click').show();
    $('#btn-rastreamento').off('click').show();

    if (pedido.status === 'PENDENTE') {
        $('#btn-imprimir').text('Imprimir Etiqueta').on('click', () => { 
            alert('Funcionalidade de impressão de etiqueta será implementada aqui'); 
        });
    } else if (pedido.status === 'EM_ROTA') {
        $('#btn-imprimir').text('Reimprimir Etiqueta').on('click', () => { 
            alert('Funcionalidade de reimpressão de etiqueta será implementada aqui'); 
        });
    } else {
        $('#btn-imprimir').hide();
    }

    $('#btn-rastreamento').on('click', () => {
        $('#timeline-rastreamento')[0].scrollIntoView({ behavior: 'smooth' });
    });
}

// --- Inicialização / eventos ---
$(document).ready(function () {
    // Carregamento inicial
    carregarDadosIniciais();

    // Bind botões/formulários
    $('#btn-buscar').on('click', buscarPedidos);
    $('#input-busca').on('keyup', function (e) { 
        if (e.key === 'Enter') buscarPedidos(); 
    });

    $('#btn-limpar-filtros').on('click', limparFiltros);

    $('#btn-novo-pedido').on('click', () => $('#modal-novo-pedido').modal('show'));
    $('#form-pedido').on('submit', function (e) {
        e.preventDefault();
        criarPedido();
    });
    
    
    
    // Filtros
    $('#filtro-status, #filtro-cliente, #filtro-data-inicio, #filtro-data-fim').on('change', aplicarFiltros);
    
    // Tipo de operação change
    $('#tipo-operacao').on('change', function() {
        popularOperacoesPorTipo($(this).val());
    });

    // Delegação de eventos para ações da tabela
    $(document).on('click', '.btn-view', function () {
        const id = $(this).data('id');
        verDetalhesPedido(id);
    });
    
    $(document).on('click', '.btn-edit', function () {
        const id = $(this).data('id');
        abrirEdicaoPedido(id);
    });
    
    $(document).on('click', '.btn-delete', function () {
        const id = $(this).data('id');
        excluirPedido(id);
    });
});

// --- Expor funções ao escopo global (HTML inline compat) ---
window.filtrarPorStatus = filtrarPorStatus;
window.buscarPedidos = buscarPedidos;
window.limparFiltros = limparFiltros;
window.abrirModalNovoPedido = () => $('#modal-novo-pedido').modal('show');
window.criarPedido = criarPedido;
window.verDetalhesPedido = verDetalhesPedido;
window.abrirModalAssociarOperacao = abrirModalAssociarOperacao;
window.aplicarFiltros = aplicarFiltros;
window.popularOperacoesPorTipo = popularOperacoesPorTipo;
window.associarOperacao = associarOperacao;
window.removerAssociacao = removerAssociacao;