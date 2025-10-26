// expedicao.js - Versão reformulada seguindo o padrão do gestao.js
const API_BASE_URL = 'http://localhost:8080';
const PAGE_SIZE = 10;

// Status Definitions
const STATUS_EXPEDICAO = {
    'AGUARDANDO_SEPARACAO': { class: 'badge-pendente', text: 'Pendente' },
    'ENVIADO': { class: 'badge-concluido', text: 'Enviado' },
    'EM_TRANSITO': { class: 'badge-em-andamento', text: 'Em Trânsito' },
    'EXCECAO': { class: 'badge-excecao', text: 'Exceção' }
};

const STATUS_SEPARACAO = {
    'PENDENTE': { class: 'badge-pendente', text: 'Pendente' },
    'SEPARADO': { class: 'badge-concluido', text: 'Separado' },
    'AGUARDANDO_COLETA': { class: 'badge-em-andamento', text: 'Aguardando Coleta' },
    'EXCECAO': { class: 'badge-excecao', text: 'Exceção' }
};

const STATUS_COLETA = {
    'PENDENTE': { class: 'badge-pendente', text: 'Pendente' },
    'REALIZADA': { class: 'badge-concluido', text: 'Realizada' },
    'EM_TRANSITO': { class: 'badge-em-andamento', text: 'Em Trânsito' },
    'EXCECAO': { class: 'badge-excecao', text: 'Exceção' }
};

// Application State
let expedicoesData = [];
let separacoesData = [];
let coletasData = [];
let pedidosData = [];
let motoristasData = [];

let expedicoesCurrentPage = 1;
let expedicoesTotalPages = 1;
let separacoesCurrentPage = 1;
let separacoesTotalPages = 1;
let coletasCurrentPage = 1;
let coletasTotalPages = 1;

let filtrosAtuaisExpedicoes = {};
let filtrosAtuaisSeparacoes = {};
let filtrosAtuaisColetas = {};

// ---------- Authentication Functions (igual ao gestao.js) ----------
function verificarAutenticacao() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

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

async function apiRequest(path, method = 'GET', data = null, query = null) {
    try {
        const url = new URL(API_BASE_URL + path);
        if (query && typeof query === 'object') {
            Object.entries(query).forEach(([k, v]) => {
                if (v !== undefined && v !== null) url.searchParams.append(k, v);
            });
        }

        const options = { method };
        if (data && (method === 'POST' || method === 'PUT')) options.body = JSON.stringify(data);

        const { ok, data: responseData } = await apiFetch(url.toString(), options);

        if (!ok) throw new Error(responseData.message || 'Erro desconhecido');

        return responseData;
    } catch (err) {
        console.error('API request error:', path, err);
        throw err;
    }
}

// ---------- Utility Functions (padronizadas com gestao.js) ----------
function formatarData(dataString) {
    if (!dataString) return '-';
    const d = new Date(dataString);
    if (isNaN(d)) return dataString;
    return d.toLocaleString('pt-BR');
}

function mostrarCarregamento(mostrar) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = mostrar ? 'block' : 'none';
    }
}

function mostrarFeedback(mensagem, tipo) {
    const feedback = document.getElementById('real-time-feedback');
    if (!feedback) return;

    feedback.classList.remove('feedback-success', 'feedback-error', 'feedback-warning', 'feedback-info');
    feedback.classList.add('feedback-' + tipo);
    feedback.textContent = mensagem;
    feedback.style.display = 'block';

    setTimeout(() => {
        feedback.style.display = 'none';
    }, 3000);
}

// ---------- Expedição Functions (padronizadas) ----------
async function carregarExpedicoes(filtros = {}, page = 1, limit = PAGE_SIZE) {
    try {
        mostrarCarregamento(true);
        
        // Construir query parameters
        const queryParams = {
            page,
            limit,
            ...filtros
        };

        const data = await apiRequest('/expedicoes', 'GET', null, queryParams);
        
        expedicoesData = data.expedicoes || [];
        expedicoesTotalPages = data.totalPages || 1;
        expedicoesCurrentPage = data.currentPage || 1;

        renderizarExpedicoesPagina(expedicoesCurrentPage);
        atualizarCardsResumoExpedicoes();
    } catch (err) {
        console.error('Erro ao carregar expedições', err);
        const tbody = document.getElementById('tabela-expedicoes');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Erro ao carregar dados</td></tr>';
        }
    } finally {
        mostrarCarregamento(false);
    }
}

function renderizarExpedicoesPagina(page = 1) {
    const tbody = document.getElementById('tabela-expedicoes');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!Array.isArray(expedicoesData) || expedicoesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhuma expedição encontrada</td></tr>';
        renderPaginationExpedicoes();
        return;
    }

    expedicoesData.forEach(e => {
        const status = STATUS_EXPEDICAO[e.status] || { class: '', text: e.status || '-' };
        const dataEnvio = formatarData(e.data_envio);

        const tr = document.createElement('tr');
        tr.dataset.id = e.id;

        tr.innerHTML = `
            <td>${e.id}</td>
            <td>${e.pedido ? e.pedido.codigo_pedido : (e.id_pedido || '-')}</td>
            <td>${e.nota_fiscal || '-'}</td>
            <td>${e.codigo_rastreio || '-'}</td>
            <td>${dataEnvio}</td>
            <td><span class="badge ${status.class} status-badge">${status.text}</span></td>
            <td class="table-actions">
                <div class="action-buttons">
                    <button class="btn btn-sm btn-info btn-view-exp" data-id="${e.id}" title="Ver"><i class="fas fa-eye"></i></button>
                    ${e.status !== 'ENVIADO' ? `
                    <button class="btn btn-sm btn-primary btn-edit-exp" data-id="${e.id}" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-success btn-concluir-exp" data-id="${e.id}" title="Concluir"><i class="fas fa-check"></i></button>
                    ` : ''}
                    <button class="btn btn-sm btn-danger btn-delete-exp" data-id="${e.id}" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    renderPaginationExpedicoes();
}

function renderPaginationExpedicoes() {
    let container = document.getElementById('pagination-expedicoes');
    if (!container) {
        const nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Paginação Expedicoes');
        container = document.createElement('ul');
        container.id = 'pagination-expedicoes';
        container.className = 'pagination justify-content-end mt-2';
        nav.appendChild(container);

        const cardBody = document.querySelector('#tabela-expedicoes').closest('.card-body');
        if (cardBody) {
            cardBody.parentNode.insertBefore(nav, cardBody.nextSibling);
        }
    }

    container.innerHTML = '';

    const total = expedicoesTotalPages;
    const current = expedicoesCurrentPage;

    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${current === 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.innerHTML = '«';
    prevLi.appendChild(prevLink);

    prevLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (current > 1) {
            carregarExpedicoes(filtrosAtuaisExpedicoes, current - 1);
        }
    });

    container.appendChild(prevLi);

    const maxShow = 9;
    let start = 1;
    let end = total;
    if (total > maxShow) {
        const half = Math.floor(maxShow / 2);
        start = Math.max(1, current - half);
        end = Math.min(total, start + maxShow - 1);
        if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);
    }

    for (let p = start; p <= end; p++) {
        const li = document.createElement('li');
        li.className = `page-item ${p === current ? 'active' : ''}`;
        const link = document.createElement('a');
        link.className = 'page-link';
        link.href = '#';
        link.textContent = p;
        li.appendChild(link);

        link.addEventListener('click', (e) => {
            e.preventDefault();
            carregarExpedicoes(filtrosAtuaisExpedicoes, p);
        });

        container.appendChild(li);
    }

    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${current === total ? 'disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.innerHTML = '»';
    nextLi.appendChild(nextLink);

    nextLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (current < total) {
            carregarExpedicoes(filtrosAtuaisExpedicoes, current + 1);
        }
    });

    container.appendChild(nextLi);
}

function atualizarCardsResumoExpedicoes() {
    const data = Array.isArray(expedicoesData) ? expedicoesData : [];

    const elementos = {
        'total-pendente-exp': data.filter(e => e.status === 'AGUARDANDO_SEPARACAO').length,
        'total-enviado-exp': data.filter(e => e.status === 'ENVIADO').length,
        'total-transito-exp': data.filter(e => e.status === 'EM_TRANSITO').length,
        'total-excecao-exp': data.filter(e => e.status === 'EXCECAO').length
    };

    Object.entries(elementos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    });
}

// ---------- Separação Functions (padronizadas) ----------
async function carregarSeparacoes(filtros = {}, page = 1, limit = PAGE_SIZE) {
    try {
        mostrarCarregamento(true);
        
        const queryParams = {
            page,
            limit,
            ...filtros
        };

        const data = await apiRequest('/separacoes', 'GET', null, queryParams);
        
        separacoesData = data.separacoes || [];
        separacoesTotalPages = data.totalPages || 1;
        separacoesCurrentPage = data.currentPage || 1;

        renderizarSeparacoesPagina(separacoesCurrentPage);
        atualizarCardsResumoSeparacoes();
    } catch (err) {
        console.error('Erro ao carregar separações', err);
        const tbody = document.getElementById('tabela-separacoes');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar dados</td></tr>';
        }
    } finally {
        mostrarCarregamento(false);
    }
}

function renderizarSeparacoesPagina(page = 1) {
    const tbody = document.getElementById('tabela-separacoes');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!Array.isArray(separacoesData) || separacoesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma separação encontrada</td></tr>';
        renderPaginationSeparacoes();
        return;
    }

    separacoesData.forEach(s => {
        const status = STATUS_SEPARACAO[s.status] || { class: '', text: s.status || '-' };
        const dataSeparacao = formatarData(s.data_separacao);

        const tr = document.createElement('tr');
        tr.dataset.id = s.id;

        tr.innerHTML = `
            <td>${s.id}</td>
            <td>${s.pedido ? s.pedido.codigo_pedido : (s.id_pedido || '-')}</td>
            <td>${dataSeparacao}</td>
            <td>${s.corredor_gaiola || '-'}</td>
            <td><span class="badge ${status.class} status-badge">${status.text}</span></td>
            <td class="table-actions">
                <div class="action-buttons">
                    <button class="btn btn-sm btn-info btn-view-sep" data-id="${s.id}" title="Ver"><i class="fas fa-eye"></i></button>
                    ${s.status === 'PENDENTE' ? `
                    <button class="btn btn-sm btn-success btn-marcar-separado" data-id="${s.id}" title="Marcar como Separado"><i class="fas fa-check"></i></button>
                    ` : ''}
                    <button class="btn btn-sm btn-danger btn-delete-sep" data-id="${s.id}" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    renderPaginationSeparacoes();
}

function renderPaginationSeparacoes() {
    let container = document.getElementById('pagination-separacoes');
    if (!container) {
        const nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Paginação Separações');
        container = document.createElement('ul');
        container.id = 'pagination-separacoes';
        container.className = 'pagination justify-content-end mt-2';
        nav.appendChild(container);

        const cardBody = document.querySelector('#tabela-separacoes').closest('.card-body');
        if (cardBody) {
            cardBody.parentNode.insertBefore(nav, cardBody.nextSibling);
        }
    }

    container.innerHTML = '';

    const total = separacoesTotalPages;
    const current = separacoesCurrentPage;

    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${current === 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.innerHTML = '«';
    prevLi.appendChild(prevLink);

    prevLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (current > 1) {
            carregarSeparacoes(filtrosAtuaisSeparacoes, current - 1);
        }
    });

    container.appendChild(prevLi);

    const maxShow = 9;
    let start = 1;
    let end = total;
    if (total > maxShow) {
        const half = Math.floor(maxShow / 2);
        start = Math.max(1, current - half);
        end = Math.min(total, start + maxShow - 1);
        if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);
    }

    for (let p = start; p <= end; p++) {
        const li = document.createElement('li');
        li.className = `page-item ${p === current ? 'active' : ''}`;
        const link = document.createElement('a');
        link.className = 'page-link';
        link.href = '#';
        link.textContent = p;
        li.appendChild(link);

        link.addEventListener('click', (e) => {
            e.preventDefault();
            carregarSeparacoes(filtrosAtuaisSeparacoes, p);
        });

        container.appendChild(li);
    }

    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${current === total ? 'disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.innerHTML = '»';
    nextLi.appendChild(nextLink);

    nextLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (current < total) {
            carregarSeparacoes(filtrosAtuaisSeparacoes, current + 1);
        }
    });

    container.appendChild(nextLi);
}

function atualizarCardsResumoSeparacoes() {
    const data = Array.isArray(separacoesData) ? separacoesData : [];

    const elementos = {
        'total-pendente-sep': data.filter(s => s.status === 'PENDENTE').length,
        'total-separado-sep': data.filter(s => s.status === 'SEPARADO').length,
        'total-aguardando-sep': data.filter(s => s.status === 'AGUARDANDO_COLETA').length,
        'total-excecao-sep': data.filter(s => s.status === 'EXCECAO').length
    };

    Object.entries(elementos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    });
}

// ---------- Coleta Functions (padronizadas) ----------
async function carregarColetas(filtros = {}, page = 1, limit = PAGE_SIZE) {
    try {
        mostrarCarregamento(true);
        
        const queryParams = {
            page,
            limit,
            ...filtros
        };

        const data = await apiRequest('/coletas', 'GET', null, queryParams);
        
        coletasData = data.coletas || [];
        coletasTotalPages = data.totalPages || 1;
        coletasCurrentPage = data.currentPage || 1;

        renderizarColetasPagina(coletasCurrentPage);
        atualizarCardsResumoColetas();
    } catch (err) {
        console.error('Erro ao carregar coletas', err);
        const tbody = document.getElementById('tabela-coletas');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Erro ao carregar dados</td></tr>';
        }
    } finally {
        mostrarCarregamento(false);
    }
}

function renderizarColetasPagina(page = 1) {
    const tbody = document.getElementById('tabela-coletas');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!Array.isArray(coletasData) || coletasData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhuma coleta encontrada</td></tr>';
        renderPaginationColetas();
        return;
    }

    coletasData.forEach(c => {
        const status = STATUS_COLETA[c.status] || { class: '', text: c.status || '-' };
        const dataColeta = formatarData(c.data_coleta);
        const agendamento = formatarData(c.agendamento);

        const tr = document.createElement('tr');
        tr.dataset.id = c.id;

        tr.innerHTML = `
            <td>${c.id}</td>
            <td>${c.pedido ? c.pedido.codigo_pedido : (c.id_pedido || '-')}</td>
            <td>${c.motorista ? c.motorista.nome : (c.id_motorista || '-')}</td>
            <td>${agendamento}</td>
            <td>${dataColeta}</td>
            <td><span class="badge ${status.class} status-badge">${status.text}</span></td>
            <td class="table-actions">
                <div class="action-buttons">
                    <button class="btn btn-sm btn-info btn-view-col" data-id="${c.id}" title="Ver"><i class="fas fa-eye"></i></button>
                    ${c.status === 'PENDENTE' ? `
                    <button class="btn btn-sm btn-success btn-marcar-coletado" data-id="${c.id}" title="Marcar como Coletado"><i class="fas fa-check"></i></button>
                    ` : ''}
                    <button class="btn btn-sm btn-danger btn-delete-col" data-id="${c.id}" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    renderPaginationColetas();
}

function renderPaginationColetas() {
    let container = document.getElementById('pagination-coletas');
    if (!container) {
        const nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Paginação Coletas');
        container = document.createElement('ul');
        container.id = 'pagination-coletas';
        container.className = 'pagination justify-content-end mt-2';
        nav.appendChild(container);

        const cardBody = document.querySelector('#tabela-coletas').closest('.card-body');
        if (cardBody) {
            cardBody.parentNode.insertBefore(nav, cardBody.nextSibling);
        }
    }

    container.innerHTML = '';

    const total = coletasTotalPages;
    const current = coletasCurrentPage;

    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${current === 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.innerHTML = '«';
    prevLi.appendChild(prevLink);

    prevLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (current > 1) {
            carregarColetas(filtrosAtuaisColetas, current - 1);
        }
    });

    container.appendChild(prevLi);

    const maxShow = 9;
    let start = 1;
    let end = total;
    if (total > maxShow) {
        const half = Math.floor(maxShow / 2);
        start = Math.max(1, current - half);
        end = Math.min(total, start + maxShow - 1);
        if (end - start < maxShow - 1) start = Math.max(1, end - maxShow + 1);
    }

    for (let p = start; p <= end; p++) {
        const li = document.createElement('li');
        li.className = `page-item ${p === current ? 'active' : ''}`;
        const link = document.createElement('a');
        link.className = 'page-link';
        link.href = '#';
        link.textContent = p;
        li.appendChild(link);

        link.addEventListener('click', (e) => {
            e.preventDefault();
            carregarColetas(filtrosAtuaisColetas, p);
        });

        container.appendChild(li);
    }

    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${current === total ? 'disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.innerHTML = '»';
    nextLi.appendChild(nextLink);

    nextLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (current < total) {
            carregarColetas(filtrosAtuaisColetas, current + 1);
        }
    });

    container.appendChild(nextLi);
}

function atualizarCardsResumoColetas() {
    const data = Array.isArray(coletasData) ? coletasData : [];

    const elementos = {
        'total-pendente-col': data.filter(c => c.status === 'PENDENTE').length,
        'total-realizada-col': data.filter(c => c.status === 'REALIZADA').length,
        'total-transito-col': data.filter(c => c.status === 'EM_TRANSITO').length,
        'total-excecao-col': data.filter(c => c.status === 'EXCECAO').length
    };

    Object.entries(elementos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    });
}

// ---------- Filtro Functions (padronizadas) ----------
async function aplicarFiltrosExpedicoes() {
    const filtros = {
        id: document.getElementById('filtro-id-exp').value,
        status: document.getElementById('filtro-status-exp').value,
        data: document.getElementById('filtro-data-exp').value
    };

    // Limpar filtros vazios
    Object.keys(filtros).forEach(key => {
        if (!filtros[key]) delete filtros[key];
    });

    filtrosAtuaisExpedicoes = filtros;
    await carregarExpedicoes(filtros, 1);
}

async function aplicarFiltrosSeparacoes() {
    const filtros = {
        id: document.getElementById('filtro-id-sep').value,
        status: document.getElementById('filtro-status-sep').value,
        data: document.getElementById('filtro-data-sep').value
    };

    // Limpar filtros vazios
    Object.keys(filtros).forEach(key => {
        if (!filtros[key]) delete filtros[key];
    });

    filtrosAtuaisSeparacoes = filtros;
    await carregarSeparacoes(filtros, 1);
}

async function aplicarFiltrosColetas() {
    const filtros = {
        id: document.getElementById('filtro-id-col').value,
        status: document.getElementById('filtro-status-col').value,
        data: document.getElementById('filtro-data-col').value
    };

    // Limpar filtros vazios
    Object.keys(filtros).forEach(key => {
        if (!filtros[key]) delete filtros[key];
    });

    filtrosAtuaisColetas = filtros;
    await carregarColetas(filtros, 1);
}

function limparFiltrosExpedicoes() {
    document.getElementById('filtro-id-exp').value = '';
    document.getElementById('filtro-status-exp').value = '';
    document.getElementById('filtro-data-exp').value = '';

    filtrosAtuaisExpedicoes = {};
    carregarExpedicoes({}, 1);
}

function limparFiltrosSeparacoes() {
    document.getElementById('filtro-id-sep').value = '';
    document.getElementById('filtro-status-sep').value = '';
    document.getElementById('filtro-data-sep').value = '';

    filtrosAtuaisSeparacoes = {};
    carregarSeparacoes({}, 1);
}

function limparFiltrosColetas() {
    document.getElementById('filtro-id-col').value = '';
    document.getElementById('filtro-status-col').value = '';
    document.getElementById('filtro-data-col').value = '';

    filtrosAtuaisColetas = {};
    carregarColetas({}, 1);
}

// ---------- Modal Functions (padronizadas) ----------
async function abrirModalNovaExpedicao() {
    try {
        // Carregar pedidos disponíveis
        const pedidos = await apiRequest('/pedidos/disponiveis-expedicao', 'GET');
        pedidosData = Array.isArray(pedidos) ? pedidos : [];
        
        const selectPedido = document.getElementById('nova-expedicao-pedido');
        selectPedido.innerHTML = '<option value="">Selecione</option>';
        
        pedidosData.forEach(pedido => {
            const option = document.createElement('option');
            option.value = pedido.id;
            option.textContent = `${pedido.codigo_pedido} - ${pedido.cliente_nome || 'Cliente não informado'}`;
            selectPedido.appendChild(option);
        });
        
        // Abrir modal
        const modalElement = document.getElementById('modal-nova-expedicao');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    } catch (error) {
        console.error('Erro ao abrir modal de nova expedição:', error);
        mostrarFeedback('Erro ao carregar dados: ' + error.message, 'error');
    }
}

async function abrirModalDetalhesExpedicao(id) {
    try {
        const expedicao = await apiRequest(`/expedicoes/${id}`, 'GET');
        
        if (!expedicao) {
            mostrarFeedback('Expedição não encontrada', 'error');
            return;
        }
        
        // Preencher detalhes
        document.getElementById('detalhe-id-exp-badge').textContent = `#${expedicao.id}`;
        document.getElementById('detalhe-pedido-exp').textContent = expedicao.pedido ? expedicao.pedido.codigo_pedido : expedicao.id_pedido;
        document.getElementById('detalhe-nota-fiscal-exp').textContent = expedicao.nota_fiscal || '-';
        document.getElementById('detalhe-codigo-rastreio-exp').textContent = expedicao.codigo_rastreio || '-';
        document.getElementById('detalhe-data-envio-exp').textContent = formatarData(expedicao.data_envio);
        
        const status = STATUS_EXPEDICAO[expedicao.status] || { class: '', text: expedicao.status || '-' };
        const statusBadge = document.getElementById('detalhe-status-exp');
        statusBadge.className = `badge ${status.class}`;
        statusBadge.textContent = status.text;
        
        // Informações de separação (se disponível)
        if (expedicao.separacao) {
            document.getElementById('detalhe-status-separacao-exp').textContent = expedicao.separacao.status || '-';
            document.getElementById('detalhe-data-separacao-exp').textContent = formatarData(expedicao.separacao.data_separacao);
            document.getElementById('detalhe-corredor-exp').textContent = expedicao.separacao.corredor_gaiola || '-';
            
            // Informações de coleta (se disponível)
            if (expedicao.separacao.coleta) {
                document.getElementById('detalhe-status-coleta-exp').textContent = expedicao.separacao.coleta.status || '-';
                document.getElementById('detalhe-data-coleta-exp').textContent = formatarData(expedicao.separacao.coleta.data_coleta);
            } else {
                document.getElementById('detalhe-status-coleta-exp').textContent = '-';
                document.getElementById('detalhe-data-coleta-exp').textContent = '-';
            }
        } else {
            document.getElementById('detalhe-status-separacao-exp').textContent = '-';
            document.getElementById('detalhe-data-separacao-exp').textContent = '-';
            document.getElementById('detalhe-corredor-exp').textContent = '-';
            document.getElementById('detalhe-status-coleta-exp').textContent = '-';
            document.getElementById('detalhe-data-coleta-exp').textContent = '-';
        }
        
        // Exceção (se houver)
        if (expedicao.excecao) {
            document.getElementById('detalhe-excecao-exp').style.display = 'block';
            document.getElementById('detalhe-excecao-texto-exp').textContent = expedicao.excecao.descricao || 'Exceção não especificada';
        } else {
            document.getElementById('detalhe-excecao-exp').style.display = 'none';
        }
        
        // Configurar botão de concluir
        const btnConcluir = document.getElementById('btn-concluir-exp');
        if (btnConcluir) {
            if (expedicao.status === 'AGUARDANDO_SEPARACAO' || expedicao.status === 'EM_TRANSITO') {
                btnConcluir.style.display = 'block';
                btnConcluir.onclick = () => concluirExpedicao(expedicao.id);
            } else {
                btnConcluir.style.display = 'none';
            }
        }
        
        // Abrir modal
        const modalElement = document.getElementById('modal-detalhes-expedicao');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    } catch (error) {
        console.error('Erro ao carregar detalhes da expedição:', error);
        mostrarFeedback('Erro ao carregar detalhes: ' + error.message, 'error');
    }
}

async function abrirModalMarcarSeparado(id) {
    try {
        document.getElementById('separacao-id').value = id;
        
        // Abrir modal
        const modalElement = document.getElementById('modal-marcar-separado');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    } catch (error) {
        console.error('Erro ao abrir modal de marcar como separado:', error);
        mostrarFeedback('Erro ao abrir modal: ' + error.message, 'error');
    }
}

async function abrirModalMarcarColetado(id) {
    try {
        document.getElementById('coleta-id').value = id;
        
        // Carregar motoristas disponíveis
        const motoristas = await apiRequest('/motoristas', 'GET');
        motoristasData = Array.isArray(motoristas) ? motoristas : [];
        
        const selectMotorista = document.getElementById('coleta-motorista');
        selectMotorista.innerHTML = '<option value="">Selecione</option>';
        
        motoristasData.forEach(motorista => {
            const option = document.createElement('option');
            option.value = motorista.id;
            option.textContent = `${motorista.nome} - ${motorista.veiculo || 'Veículo não informado'}`;
            selectMotorista.appendChild(option);
        });
        
        // Preencher data atual como padrão
        const now = new Date();
        const localDatetime = now.toISOString().slice(0, 16);
        document.getElementById('coleta-data').value = localDatetime;
        
        // Abrir modal
        const modalElement = document.getElementById('modal-marcar-coletado');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    } catch (error) {
        console.error('Erro ao abrir modal de marcar como coletado:', error);
        mostrarFeedback('Erro ao abrir modal: ' + error.message, 'error');
    }
}

// ---------- Action Functions (padronizadas) ----------
async function criarExpedicao(e) {
    e.preventDefault();
    
    try {
        mostrarCarregamento(true);
        
        const pedidoId = document.getElementById('nova-expedicao-pedido').value;
        const dataEnvio = document.getElementById('nova-expedicao-data-envio').value;
        
        if (!pedidoId) {
            mostrarFeedback('Selecione um pedido', 'error');
            return;
        }
        
        const expedicaoData = {
            id_pedido: pedidoId,
            data_envio: dataEnvio
        };
        
        await apiRequest('/expedicoes', 'POST', expedicaoData);
        
        mostrarFeedback('Expedição criada com sucesso!', 'success');
        
        // Fechar modal e recarregar dados
        const modalElement = document.getElementById('modal-nova-expedicao');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
        }
        
        await carregarExpedicoes(filtrosAtuaisExpedicoes, expedicoesCurrentPage);
    } catch (error) {
        console.error('Erro ao criar expedição:', error);
        mostrarFeedback('Erro ao criar expedição: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function marcarComoSeparado(e) {
    e.preventDefault();
    
    try {
        mostrarCarregamento(true);
        
        const separacaoId = document.getElementById('separacao-id').value;
        const corredorGaiola = document.getElementById('separacao-corredor').value;
        
        await apiRequest(`/separacoes/${separacaoId}/separar`, 'PUT', {
            corredor_gaiola: corredorGaiola
        });
        
        mostrarFeedback('Separação concluída com sucesso!', 'success');
        
        // Fechar modal e recarregar dados
        const modalElement = document.getElementById('modal-marcar-separado');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
        }
        
        await carregarSeparacoes(filtrosAtuaisSeparacoes, separacoesCurrentPage);
    } catch (error) {
        console.error('Erro ao marcar como separado:', error);
        mostrarFeedback('Erro ao marcar como separado: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function marcarComoColetado(e) {
    e.preventDefault();
    
    try {
        mostrarCarregamento(true);
        
        const coletaId = document.getElementById('coleta-id').value;
        const motoristaId = document.getElementById('coleta-motorista').value;
        const dataColeta = document.getElementById('coleta-data').value;
        
        if (!motoristaId) {
            mostrarFeedback('Selecione um motorista', 'error');
            return;
        }
        
        await apiRequest(`/coletas/${coletaId}/coletar`, 'PUT', {
            id_motorista: motoristaId,
            data_coleta: dataColeta
        });
        
        mostrarFeedback('Coleta realizada com sucesso!', 'success');
        
        // Fechar modal e recarregar dados
        const modalElement = document.getElementById('modal-marcar-coletado');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
        }
        
        await carregarColetas(filtrosAtuaisColetas, coletasCurrentPage);
    } catch (error) {
        console.error('Erro ao marcar como coletado:', error);
        mostrarFeedback('Erro ao marcar como coletado: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function concluirExpedicao(id) {
    if (!confirm('Deseja concluir esta expedição?')) return;
    
    try {
        mostrarCarregamento(true);
        await apiRequest(`/expedicoes/${id}/concluir`, 'PUT');
        mostrarFeedback('Expedição concluída com sucesso!', 'success');
        
        // Fechar modal e recarregar dados
        const modalElement = document.getElementById('modal-detalhes-expedicao');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
        }
        
        await carregarExpedicoes(filtrosAtuaisExpedicoes, expedicoesCurrentPage);
    } catch (error) {
        console.error('Erro ao concluir expedição:', error);
        mostrarFeedback('Erro ao concluir expedição: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

// ---------- Inicialização (padronizada) ----------
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

    // Inicializar dados
    carregarExpedicoes();
    carregarSeparacoes();
    carregarColetas();

    // Configurar eventos
    configurarEventos();
});

function configurarEventos() {
    // Eventos de expedição
    document.addEventListener('click', function (e) {
        if (e.target.closest('.btn-view-exp')) {
            const id = e.target.closest('.btn-view-exp').dataset.id;
            abrirModalDetalhesExpedicao(id);
        }

        if (e.target.closest('.btn-concluir-exp')) {
            const id = e.target.closest('.btn-concluir-exp').dataset.id;
            concluirExpedicao(id);
        }
    });

    // Eventos de separação
    document.addEventListener('click', function (e) {
        if (e.target.closest('.btn-marcar-separado')) {
            const id = e.target.closest('.btn-marcar-separado').dataset.id;
            abrirModalMarcarSeparado(id);
        }
    });

    // Eventos de coleta
    document.addEventListener('click', function (e) {
        if (e.target.closest('.btn-marcar-coletado')) {
            const id = e.target.closest('.btn-marcar-coletado').dataset.id;
            abrirModalMarcarColetado(id);
        }
    });

    // Eventos de filtro
    const btnFiltrarExp = document.getElementById('btn-filtrar-exp');
    const btnLimparFiltrosExp = document.getElementById('btn-limpar-filtros-exp');
    const btnFiltrarSep = document.getElementById('btn-filtrar-sep');
    const btnLimparFiltrosSep = document.getElementById('btn-limpar-filtros-sep');
    const btnFiltrarCol = document.getElementById('btn-filtrar-col');
    const btnLimparFiltrosCol = document.getElementById('btn-limpar-filtros-col');

    if (btnFiltrarExp) {
        btnFiltrarExp.addEventListener('click', aplicarFiltrosExpedicoes);
    }

    if (btnLimparFiltrosExp) {
        btnLimparFiltrosExp.addEventListener('click', limparFiltrosExpedicoes);
    }

    if (btnFiltrarSep) {
        btnFiltrarSep.addEventListener('click', aplicarFiltrosSeparacoes);
    }

    if (btnLimparFiltrosSep) {
        btnLimparFiltrosSep.addEventListener('click', limparFiltrosSeparacoes);
    }

    if (btnFiltrarCol) {
        btnFiltrarCol.addEventListener('click', aplicarFiltrosColetas);
    }

    if (btnLimparFiltrosCol) {
        btnLimparFiltrosCol.addEventListener('click', limparFiltrosColetas);
    }

    // Event listeners para os formulários
    const formNovaExpedicao = document.getElementById('form-nova-expedicao');
    const formMarcarSeparado = document.getElementById('form-marcar-separado');
    const formMarcarColetado = document.getElementById('form-marcar-coletado');
    
    if (formNovaExpedicao) {
        formNovaExpedicao.addEventListener('submit', criarExpedicao);
    }
    
    if (formMarcarSeparado) {
        formMarcarSeparado.addEventListener('submit', marcarComoSeparado);
    }
    
    if (formMarcarColetado) {
        formMarcarColetado.addEventListener('submit', marcarComoColetado);
    }

    // Atualizar ano no footer
    document.getElementById('ano-curr').textContent = new Date().getFullYear();
}

// ---------- Global Functions (padronizadas) ----------
window.filtrarExpedicoesPorStatus = function (status) {
    document.getElementById('filtro-status-exp').value = status;
    aplicarFiltrosExpedicoes();
}

window.filtrarSeparacoesPorStatus = function (status) {
    document.getElementById('filtro-status-sep').value = status;
    aplicarFiltrosSeparacoes();
}

window.filtrarColetasPorStatus = function (status) {
    document.getElementById('filtro-status-col').value = status;
    aplicarFiltrosColetas();
}

window.abrirModalNovaExpedicao = abrirModalNovaExpedicao;