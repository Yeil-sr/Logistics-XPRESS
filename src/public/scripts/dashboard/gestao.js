const API_BASE_URL = 'http://localhost:8080';
const PAGE_SIZE = 10;

// ---------- Status Definitions ----------
const STATUS = {
    'PENDENTE': { class: 'badge-pendente', text: 'Pendente' },
    'EM_ANDAMENTO': { class: 'badge-em-andamento', text: 'Em Andamento' },
    'CONCLUIDO': { class: 'badge-concluido', text: 'Concluído' },
    'EXCECAO': { class: 'badge-excecao', text: 'Exceção' }
};

const STATUS_PEDIDO = {
    'PENDENTE': { class: 'badge-pendente', text: 'Pendente' },
    'RECEBIDO': { class: 'badge-recebido', text: 'Recebido' },
    'VALIDADO': { class: 'badge-concluido', text: 'Validado' },
    'EXCECAO': { class: 'badge-excecao', text: 'Exceção' }
};

// ---------- Application State ----------
let conferenciasData = [];
let recebimentosData = [];
let operadoresSet = new Set();

let scannerAtivo = false;
let pedidosValidados = new Set();

// Pagination states
let conferenciasCurrentPage = 1;
let conferenciasTotalPages = 1;
let recebimentosCurrentPage = 1;
let recebimentosTotalPages = 1;

// Modal states
let modalPedidosConfData = [];
let modalPedidosConfPage = 1;
let modalPedidosConfTotalPages = 1;
let modalPedidosRecData = [];
let modalPedidosRecPage = 1;
let modalPedidosRecTotalPages = 1;

// Current conference state
let currentConferenciaId = null;
let currentTotalEsperado = 0;
let currentTotalConferido = 0;

// Edit states
let editandoConferenciaId = null;
let editandoRecebimentoId = null;

// Filtros atuais
let filtrosAtuaisConferencias = {};
let modoBuscaConferencias = false;
let termoBuscaConferencias = '';

// ---------- Authentication Functions ----------
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

// ---------- Utility Functions ----------
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

    feedback.classList.remove('feedback-success', 'feedback-error');
    feedback.classList.add('feedback-' + tipo);
    feedback.textContent = mensagem;
    feedback.style.display = 'block';

    setTimeout(() => {
        feedback.style.display = 'none';
    }, 3000);
}

function calcularPorcentagemValidacao(totalEsperado, totalConferido) {
    if (!totalEsperado || totalEsperado === 0) return 0;
    return Math.round((totalConferido / totalEsperado) * 100);
}

function atualizarBarraProgresso(porcentagem) {
    const progressBar = document.getElementById('progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');

    if (progressBar) {
        progressBar.style.width = porcentagem + '%';
        progressBar.setAttribute('aria-valuenow', porcentagem);

        if (porcentagem >= 90) {
            progressBar.classList.remove('bg-warning', 'bg-danger');
            progressBar.classList.add('bg-success');
        } else if (porcentagem >= 50) {
            progressBar.classList.remove('bg-success', 'bg-danger');
            progressBar.classList.add('bg-warning');
        } else {
            progressBar.classList.remove('bg-success', 'bg-warning');
            progressBar.classList.add('bg-danger');
        }
    }

    if (progressPercentage) {
        progressPercentage.textContent = porcentagem + '%';
    }
}

function popularSelectOperadores() {
    const operadores = Array.from(operadoresSet).sort();

    const selects = [
        document.getElementById('filtro-operador-conf'),
        document.getElementById('filtro-operador-rec'),
        document.getElementById('nova-conferencia-operador'),
        document.getElementById('novo-recebimento-operador')
    ];

    selects.forEach(select => {
        if (!select) return;

        const atual = select.value;
        select.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Todos';
        select.appendChild(defaultOption);

        operadores.forEach(op => {
            const option = document.createElement('option');
            option.value = op;
            option.textContent = op;
            select.appendChild(option);
        });

        if (atual) select.value = atual;
    });
}

// ---------- Validação de Pedidos ----------
async function validarPedidoExistente(codigoPedido) {
    try {
        const response = await apiRequest(`/pedidos/codigo/${codigoPedido}`, 'GET');
        return response !== null;
    } catch (error) {
        console.error('Erro ao validar pedido:', error);
        return false;
    }
}

// ---------- Conference Functions ----------
async function carregarConferencias(filtros = {}, page = 1, limit = PAGE_SIZE) {
    try {
        mostrarCarregamento(true);
        
        // Construir query parameters
        const queryParams = {
            page,
            limit,
            ...filtros
        };

        const data = await apiRequest('/conferencias', 'GET', null, queryParams);
        
        // A estrutura de resposta agora é um objeto com conferencias, total, totalPages, etc.
        conferenciasData = data.conferencias || [];
        conferenciasTotalPages = data.totalPages || 1;
        conferenciasCurrentPage = data.currentPage || 1;

        renderizarConferenciasPagina(conferenciasCurrentPage);
        atualizarCardsResumoConferencias();
        popularSelectOperadores();
    } catch (err) {
        console.error('Erro ao carregar conferências', err);
        const tbody = document.getElementById('tabela-conferencias');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-center text-danger">Erro ao carregar dados</td></tr>';
        }
    } finally {
        mostrarCarregamento(false);
    }
}

function renderizarConferenciasPagina(page = 1) {
    const tbody = document.getElementById('tabela-conferencias');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!Array.isArray(conferenciasData) || conferenciasData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center">Nenhuma conferência encontrada</td></tr>';
        renderPaginationConferencias();
        return;
    }

    // Já estamos com a página correta, então apenas renderizamos os dados atuais
    conferenciasData.forEach(c => {
        if (c.operador_id) operadoresSet.add(String(c.operador_id));
        const status = STATUS[c.status] || { class: '', text: c.status || '-' };
        const criado = formatarData(c.data_criacao);
        const termino = c.data_termino ? formatarData(c.data_termino) : '-';

        const totalEsperado = c.total_pedidos_iniciais || 0;
        const totalFinais = c.status === 'CONCLUIDO'
            ? (c.total_pedidos_finais || c.pedidos_escaneados || 0)
            : (c.total_pedidos_finais || 0);

        const pedidosEscaneados = c.status === 'CONCLUIDO'
            ? (c.pedidos_escaneados || totalFinais)
            : '-';

        const porcentagem = c.status === 'CONCLUIDO'
            ? (c.percentual_validacao || calcularPorcentagemValidacao(totalEsperado, totalFinais))
            : calcularPorcentagemValidacao(totalEsperado, totalFinais);

        const tr = document.createElement('tr');
        tr.dataset.id = c.id;

        tr.innerHTML = `
            <td>${c.id}</td>
            <td>${c.nome_estacao || '-'}</td>
            <td>${c.transporte ? c.transporte.numero_transporte : (c.transporte_id ? `TO-${c.transporte_id}` : '-')}</td>
            <td>${c.tipo || '-'}</td>
            <td>${criado}</td>
            <td>${termino}</td>
            <td>${totalEsperado}</td>
            <td>${totalFinais}</td>
            <td>${pedidosEscaneados}</td>
            <td>${porcentagem}%</td>
            <td>${c.operador ? c.operador.nome : (c.operador_id || '-')}</td>
            <td><span class="badge ${status.class} status-badge">${status.text}</span></td>
            <td class="table-actions">
                <div class="action-buttons">
                    <button class="btn btn-sm btn-info btn-view-conf" data-id="${c.id}" title="Ver"><i class="fas fa-eye"></i></button>
                    ${c.status !== 'CONCLUIDO' ? `
                    <button class="btn btn-sm btn-primary btn-edit-conf" data-id="${c.id}" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-success btn-concluir-conf" data-id="${c.id}" title="Concluir"><i class="fas fa-check"></i></button>
                    ` : ''}
                    <button class="btn btn-sm btn-danger btn-delete-conf" data-id="${c.id}" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    renderPaginationConferencias();
}

function renderPaginationConferencias() {
    let container = document.getElementById('pagination-conferencias');
    if (!container) {
        const nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Paginação Conferências');
        container = document.createElement('ul');
        container.id = 'pagination-conferencias';
        container.className = 'pagination justify-content-end mt-2';
        nav.appendChild(container);

        const cardBody = document.querySelector('#tabela-conferencias').closest('.card-body');
        if (cardBody) {
            cardBody.parentNode.insertBefore(nav, cardBody.nextSibling);
        }
    }

    container.innerHTML = '';

    const total = conferenciasTotalPages;
    const current = conferenciasCurrentPage;

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
            if (modoBuscaConferencias) {
                buscarConferenciasPagina(current - 1);
            } else {
                carregarConferencias(filtrosAtuaisConferencias, current - 1);
            }
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
            if (modoBuscaConferencias) {
                buscarConferenciasPagina(p);
            } else {
                carregarConferencias(filtrosAtuaisConferencias, p);
            }
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
            if (modoBuscaConferencias) {
                buscarConferenciasPagina(current + 1);
            } else {
                carregarConferencias(filtrosAtuaisConferencias, current + 1);
            }
        }
    });

    container.appendChild(nextLi);
}

function atualizarCardsResumoConferencias() {
    const data = Array.isArray(conferenciasData) ? conferenciasData : [];

    const elementos = {
        'total-pendente-conf': data.filter(c => c.status === 'PENDENTE').length,
        'total-andamento-conf': data.filter(c => c.status === 'EM_ANDAMENTO').length,
        'total-concluido-conf': data.filter(c => c.status === 'CONCLUIDO').length,
        'total-excecao-conf': data.filter(c => c.status === 'EXCECAO').length
    };

    Object.entries(elementos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    });
}

async function carregarDetalhesConferencia(id) {
    try {
        const conferencia = await apiRequest(`/conferencias/${id}`, 'GET');
        const pedidos = await apiRequest(`/conferencias/${id}/pedidos`, 'GET');
        return { conferencia, pedidos: Array.isArray(pedidos) ? pedidos : [] };
    } catch (err) {
        console.error('Erro ao carregar detalhes da conferência', err);
        throw err;
    }
}

function preencherModalDetalhesConferencia(conferencia, pedidos = []) {
    if (!conferencia) return;

    const status = STATUS[conferencia.status] || { class: '', text: conferencia.status || '-' };

    currentConferenciaId = conferencia.id;
    currentTotalEsperado = conferencia.total_pedidos_iniciais || 0;
    currentTotalConferido = conferencia.status === 'CONCLUIDO'
        ? conferencia.pedidos_escaneados || conferencia.total_pedidos_finais || 0
        : pedidosValidados.size;

    // Atualizar elementos do modal
    const elementos = {
        'detalhe-id-conf-badge': `#${conferencia.id}`,
        'detalhe-estacao-conf': conferencia.nome_estacao || '-',
        'detalhe-transporte-conf': conferencia.transporte_id ? `TO-${conferencia.transporte_id}` : '-',
        'detalhe-tipo-conf': conferencia.tipo || '-',
        'detalhe-total-esperado-conf': currentTotalEsperado,
        'detalhe-total-conferido-conf': currentTotalConferido,
        'pedidos-total': currentTotalEsperado,
        'pedidos-escaneados': currentTotalConferido
    };

    Object.entries(elementos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    });

    const statusBadge = document.getElementById('detalhe-status-conf');
    if (statusBadge) {
        statusBadge.className = `badge ${status.class}`;
        statusBadge.textContent = status.text;
    }

    const porcentagem = conferencia.status === 'CONCLUIDO'
        ? conferencia.percentual_validacao || calcularPorcentagemValidacao(currentTotalEsperado, currentTotalConferido)
        : calcularPorcentagemValidacao(currentTotalEsperado, currentTotalConferido);

    atualizarBarraProgresso(porcentagem);

    modalPedidosConfData = Array.isArray(pedidos) ? pedidos : [];
    modalPedidosConfTotalPages = Math.max(1, Math.ceil(modalPedidosConfData.length / PAGE_SIZE));
    modalPedidosConfPage = 1;
    renderModalPedidosConfPage(modalPedidosConfPage);

    const btnConcluir = document.getElementById('btn-concluir-conf');
    if (btnConcluir) {
        // Remover event listeners anteriores
        const newBtn = btnConcluir.cloneNode(true);
        btnConcluir.parentNode.replaceChild(newBtn, btnConcluir);

        if (conferencia.status !== 'CONCLUIDO') {
            newBtn.style.display = 'block';
            newBtn.className = 'btn btn-success';
            newBtn.textContent = 'Concluir Conferência';

            newBtn.addEventListener('click', async () => {
                if (!confirm('Deseja concluir esta conferência?')) return;
                await concluirConferencia(conferencia.id);
                const modal = document.getElementById('modal-detalhes-conferencia');
                if (modal) bootstrap.Modal.getInstance(modal).hide();
            });
        } else {
            newBtn.style.display = 'none';
        }
    }

    carregarEstadoValidacaoConferencia(conferencia.id);
}

function renderModalPedidosConfPage(page = 1) {
    const tbody = document.getElementById('detalhe-pedidos-conf');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!Array.isArray(modalPedidosConfData) || modalPedidosConfData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum pedido encontrado</td></tr>';
        renderPaginationModalPedidosConf();
        return;
    }

    modalPedidosConfTotalPages = Math.max(1, Math.ceil(modalPedidosConfData.length / PAGE_SIZE));
    modalPedidosConfPage = Math.min(Math.max(1, page), modalPedidosConfTotalPages);

    const start = (modalPedidosConfPage - 1) * PAGE_SIZE;
    const slice = modalPedidosConfData.slice(start, start + PAGE_SIZE);

    slice.forEach(p => {
        const statusPedido = pedidosValidados.has(p.id)
            ? { class: 'badge-success', text: 'Validado' }
            : { class: 'badge-warning', text: 'Pendente' };

        const acao = pedidosValidados.has(p.id)
            ? `<button class="btn btn-sm btn-warning btn-invalidar-pedido" 
                     data-conf-id="${p.conferencia_id}" 
                     data-pedido-id="${p.id}"
                     title="Invalidar pedido">
                 <i class="fas fa-times"></i> Invalidar
               </button>`
            : `<button class="btn btn-sm btn-success btn-validar-pedido" 
                     data-conf-id="${p.conferencia_id}" 
                     data-pedido-id="${p.id}"
                     title="Validar pedido">
                 <i class="fas fa-check"></i> Validar
               </button>`;

        const tr = document.createElement('tr');
        tr.dataset.pedidoId = p.id;

        tr.innerHTML = `
            <td>${p.codigo_pedido || p.id || '-'}</td>
            <td>${p.produto || p.produto_id || '-'}</td>
            <td><span class="badge ${statusPedido.class} status-badge">${statusPedido.text}</span></td>
            <td>${p.data_validacao ? formatarData(p.data_validacao) : '-'}</td>
            <td>${acao}</td>
        `;

        tbody.appendChild(tr);
    });

    renderPaginationModalPedidosConf();

    // Adicionar event listeners para os botões
    document.querySelectorAll('.btn-validar-pedido').forEach(btn => {
        btn.addEventListener('click', function () {
            validarPedidoConferencia(this.dataset.confId, this.dataset.pedidoId);
        });
    });

    document.querySelectorAll('.btn-invalidar-pedido').forEach(btn => {
        btn.addEventListener('click', function () {
            invalidarPedidoConferencia(this.dataset.confId, this.dataset.pedidoId);
        });
    });
}

function renderPaginationModalPedidosConf() {
    let container = document.getElementById('pagination-pedidos-conf');
    if (!container) {
        const nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Paginação pedidos');
        container = document.createElement('ul');
        container.id = 'pagination-pedidos-conf';
        container.className = 'pagination justify-content-center mt-2';
        nav.appendChild(container);

        const tableResponsive = document.querySelector('#detalhe-pedidos-conf').closest('.table-responsive');
        if (tableResponsive) {
            tableResponsive.parentNode.insertBefore(nav, tableResponsive.nextSibling);
        }
    }

    container.innerHTML = '';

    const total = modalPedidosConfTotalPages;
    const current = modalPedidosConfPage;

    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${current === 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.innerHTML = '«';
    prevLi.appendChild(prevLink);

    prevLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (current > 1) renderModalPedidosConfPage(current - 1);
    });

    container.appendChild(prevLi);

    const maxShow = 9;
    let start = 1, end = total;
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
            renderModalPedidosConfPage(p);
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
        if (current < total) renderModalPedidosConfPage(current + 1);
    });

    container.appendChild(nextLi);
}

// ---------- Funções de Validação de Pedidos ----------
async function carregarEstadoValidacaoConferencia(conferenciaId) {
    try {
        const pedidosValidadosApi = await apiRequest(`/conferencias/${conferenciaId}/pedidos-validados`, 'GET');

        pedidosValidados.clear();
        if (Array.isArray(pedidosValidadosApi)) {
            pedidosValidadosApi.forEach(pedido => {
                pedidosValidados.add(pedido.id);
            });
        }

        currentTotalConferido = pedidosValidados.size;

        const elementos = {
            'pedidos-escaneados': currentTotalConferido,
            'detalhe-total-conferido-conf': currentTotalConferido
        };

        Object.entries(elementos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.textContent = valor;
        });

        const porcentagem = calcularPorcentagemValidacao(currentTotalEsperado, currentTotalConferido);
        atualizarBarraProgresso(porcentagem);

        modalPedidosConfData.forEach(pedido => {
            if (pedidosValidados.has(pedido.id)) {
                atualizarInterfacePedidoValidado(pedido.id);
            } else {
                atualizarInterfacePedidoInvalidado(pedido.id);
            }
        });
    } catch (error) {
        console.error('Erro ao carregar estado de validação:', error);
    }
}

async function validarPedidoConferencia(conferenciaId, pedidoId) {
    try {
        mostrarCarregamento(true);
        mostrarFeedback('Validando pedido...', 'success');

        if (pedidosValidados.has(pedidoId)) {
            mostrarFeedback('Pedido já validado', 'info');
            return;
        }

        const statusCell = document.querySelector(`tr[data-pedido-id="${pedidoId}"] .status-badge`);
        if (statusCell) statusCell.classList.add('status-updating');

        await apiRequest(`/conferencias/${conferenciaId}/pedido/${pedidoId}/validar`, 'POST');

        pedidosValidados.add(pedidoId);

        if (statusCell) {
            statusCell.classList.remove('status-updating', 'badge-warning');
            statusCell.classList.add('badge-success');
            statusCell.textContent = 'Validado';
        }

        const actionCell = document.querySelector(`tr[data-pedido-id="${pedidoId}"] td:last-child`);
        if (actionCell) {
            actionCell.innerHTML = `
                <button class="btn btn-sm btn-warning btn-invalidar-pedido" 
                        data-conf-id="${conferenciaId}" 
                        data-pedido-id="${pedidoId}"
                        title="Invalidar pedido">
                    <i class="fas fa-times"></i> Invalidar
                </button>
            `;

            // Adicionar event listener ao novo botão
            const invalidarBtn = actionCell.querySelector('.btn-invalidar-pedido');
            if (invalidarBtn) {
                invalidarBtn.addEventListener('click', function () {
                    invalidarPedidoConferencia(this.dataset.confId, this.dataset.pedidoId);
                });
            }
        }

        currentTotalConferido = pedidosValidados.size;

        const elementos = {
            'pedidos-escaneados': currentTotalConferido,
            'detalhe-total-conferido-conf': currentTotalConferido
        };

        Object.entries(elementos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.textContent = valor;
        });

        const porcentagem = calcularPorcentagemValidacao(currentTotalEsperado, currentTotalConferido);
        atualizarBarraProgresso(porcentagem);

        mostrarFeedback('Pedido validado com sucesso!', 'success');

    } catch (error) {
        console.error('Erro ao validar pedido:', error);
        const statusCell = document.querySelector(`tr[data-pedido-id="${pedidoId}"] .status-badge`);
        if (statusCell) statusCell.classList.remove('status-updating');
        mostrarFeedback('Erro ao validar pedido: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function invalidarPedidoConferencia(conferenciaId, pedidoId) {
    try {
        mostrarCarregamento(true);

        await apiRequest(`/conferencias/${conferenciaId}/pedido/${pedidoId}/invalidar`, 'POST');

        pedidosValidados.delete(pedidoId);

        atualizarInterfacePedidoInvalidado(pedidoId);

        currentTotalConferido = pedidosValidados.size;

        const elementos = {
            'pedidos-escaneados': currentTotalConferido,
            'detalhe-total-conferido-conf': currentTotalConferido
        };

        Object.entries(elementos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.textContent = valor;
        });

        const porcentagem = calcularPorcentagemValidacao(currentTotalEsperado, currentTotalConferido);
        atualizarBarraProgresso(porcentagem);

        mostrarFeedback('Pedido invalidado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao invalidar pedido:', error);
        mostrarFeedback('Erro ao invalidar pedido: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

function atualizarInterfacePedidoValidado(pedidoId) {
    const statusCell = document.querySelector(`tr[data-pedido-id="${pedidoId}"] .status-badge`);
    if (statusCell) {
        statusCell.classList.remove('badge-warning');
        statusCell.classList.add('badge-success');
        statusCell.textContent = 'Validado';
    }

    const actionCell = document.querySelector(`tr[data-pedido-id="${pedidoId}"] td:last-child`);
    if (actionCell) {
        actionCell.innerHTML = `
            <button class="btn btn-sm btn-warning btn-invalidar-pedido" 
                    data-conf-id="${currentConferenciaId}" 
                    data-pedido-id="${pedidoId}"
                    title="Invalidar pedido">
                <i class="fas fa-times"></i> Invalidar
            </button>
        `;

        // Adicionar event listener ao novo botão
        const invalidarBtn = actionCell.querySelector('.btn-invalidar-pedido');
        if (invalidarBtn) {
            invalidarBtn.addEventListener('click', function () {
                invalidarPedidoConferencia(this.dataset.confId, this.dataset.pedidoId);
            });
        }
    }
}

function atualizarInterfacePedidoInvalidado(pedidoId) {
    const statusCell = document.querySelector(`tr[data-pedido-id="${pedidoId}"] .status-badge`);
    if (statusCell) {
        statusCell.classList.remove('badge-success');
        statusCell.classList.add('badge-warning');
        statusCell.textContent = 'Pendente';
    }

    const actionCell = document.querySelector(`tr[data-pedido-id="${pedidoId}"] td:last-child`);
    if (actionCell) {
        actionCell.innerHTML = `
            <button class="btn btn-sm btn-success btn-validar-pedido" 
                    data-conf-id="${currentConferenciaId}" 
                    data-pedido-id="${pedidoId}"
                    title="Validar pedido">
                <i class="fas fa-check"></i> Validar
            </button>
        `;

        // Adicionar event listener ao novo botão
        const validarBtn = actionCell.querySelector('.btn-validar-pedido');
        if (validarBtn) {
            validarBtn.addEventListener('click', function () {
                validarPedidoConferencia(this.dataset.confId, this.dataset.pedidoId);
            });
        }
    }
}

async function validarPedidoConferenciaPorCodigo(conferenciaId, codigoPedido) {
    try {
        mostrarCarregamento(true);

        const pedido = await apiRequest(`/pedidos/codigo/${codigoPedido}`, 'GET');
        if (!pedido) {
            mostrarFeedback('Pedido não encontrado', 'error');
            return;
        }

        if (pedido.conferencia_id !== parseInt(conferenciaId)) {
            mostrarFeedback('Pedido não pertence a esta conferência', 'error');
            return;
        }

        if (pedidosValidados.has(pedido.id)) {
            mostrarFeedback('Pedido já foi validado', 'info');
            return;
        }

        await apiRequest(`/conferencias/${conferenciaId}/pedido/${pedido.id}/validar`, 'POST');

        pedidosValidados.add(pedido.id);

        atualizarInterfacePedidoValidado(pedido.id);

        currentTotalConferido = pedidosValidados.size;

        const elementos = {
            'pedidos-escaneados': currentTotalConferido,
            'detalhe-total-conferido-conf': currentTotalConferido
        };

        Object.entries(elementos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.textContent = valor;
        });

        const porcentagem = calcularPorcentagemValidacao(currentTotalEsperado, currentTotalConferido);
        atualizarBarraProgresso(porcentagem);

        mostrarFeedback('Pedido validado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao validar pedido:', error);
        mostrarFeedback('Erro ao validar pedido: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

// ---------- Funções de Ações (Concluir, Reabrir, Excluir) ----------
async function concluirConferencia(id) {
    if (!confirm('Deseja concluir esta conferência?')) return;
    try {
        mostrarCarregamento(true);
        await apiRequest(`/conferencias/${id}/concluir`, 'POST');
        mostrarFeedback('Conferência concluída com sucesso!', 'success');
        await carregarConferencias(filtrosAtuaisConferencias, conferenciasCurrentPage);
    } catch (error) {
        console.error('Erro ao concluir conferência:', error);
        mostrarFeedback('Erro ao concluir conferência: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function reabrirConferencia(id) {
    if (!confirm('Deseja reabrir esta conferência?')) return;
    try {
        mostrarCarregamento(true);
        await apiRequest(`/conferencias/${id}`, 'PUT', { status: 'EM_ANDAMENTO' });
        mostrarFeedback('Conferência reaberta com sucesso!', 'success');
        await carregarConferencias(filtrosAtuaisConferencias, conferenciasCurrentPage);
    } catch (error) {
        console.error('Erro ao reabrir conferência:', error);
        mostrarFeedback('Erro ao reabrir conferência: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function excluirConferencia(id) {
    if (!confirm('Deseja realmente excluir esta conferência?')) return;
    try {
        mostrarCarregamento(true);
        await apiRequest(`/conferencias/${id}`, 'DELETE');
        mostrarFeedback('Conferência excluída com sucesso!', 'success');
        await carregarConferencias(filtrosAtuaisConferencias, 1);
    } catch (error) {
        console.error('Erro ao excluir conferência:', error);
        mostrarFeedback('Erro ao excluir conferência: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

// ---------- Funções de Recebimento ----------
async function carregarRecebimentos(filtros = {}, page = 1) {
    try {
        mostrarCarregamento(true);
        const data = await apiRequest('/recebimentos', 'GET', null, filtros);
        recebimentosData = Array.isArray(data) ? data : [];

        recebimentosTotalPages = Math.max(1, Math.ceil(recebimentosData.length / PAGE_SIZE));
        recebimentosCurrentPage = Math.min(Math.max(1, page), recebimentosTotalPages);

        renderizarRecebimentosPagina(recebimentosCurrentPage);
        atualizarCardsResumoRecebimentos();
        popularSelectOperadores();
    } catch (err) {
        console.error('Erro ao carregar recebimentos', err);
        const tbody = document.getElementById('tabela-recebimentos');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Erro ao carregar dados</td></tr>';
        }
    } finally {
        mostrarCarregamento(false);
    }
}

function renderizarRecebimentosPagina(page = 1) {
    const tbody = document.getElementById('tabela-recebimentos');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!Array.isArray(recebimentosData) || recebimentosData.length === 0) {
       tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum pedido encontrado</td></tr>';
        renderPaginationRecebimentos();
        return;
    }

    recebimentosTotalPages = Math.max(1, Math.ceil(recebimentosData.length / PAGE_SIZE));
    recebimentosCurrentPage = Math.min(Math.max(1, page), recebimentosTotalPages);
    const start = (recebimentosCurrentPage - 1) * PAGE_SIZE;
    const slice = recebimentosData.slice(start, start + PAGE_SIZE);

    slice.forEach(r => {
        if (r.operador_id) operadoresSet.add(String(r.operador_id));
        const status = STATUS[r.status] || { class: '', text: r.status || '-' };
        const criado = formatarData(r.data_criacao || r.createdAt);

        const tr = document.createElement('tr');
        tr.dataset.id = r.id;

        tr.innerHTML = `
            <td>${r.id}</td>
            <td>${r.metodo || '-'}</td>
            <td>${r.numero_manifesto || '-'}</td>
            <td>${r.quantidade_pedidos ?? 0}</td>
            <td>${r.operador_id ?? '-'}</td>
            <td><span class="badge ${status.class} status-badge">${status.text}</span></td>
            <td>${criado}</td>
            <td class="table-actions">
                <div class="action-buttons">
                    <button class="btn btn-sm btn-info btn-view-rec" data-id="${r.id}" title="Ver"><i class="fas fa-eye"></i></button>
                    ${r.status !== 'CONCLUIDO' ? `
                        <button class="btn btn-sm btn-primary btn-edit-rec" data-id="${r.id}" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-success btn-concluir-rec" data-id="${r.id}" title="Concluir"><i class="fas fa-check"></i></button>
                    ` : ''}
                    <button class="btn btn-sm btn-danger btn-delete-rec" data-id="${r.id}" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    renderPaginationRecebimentos();
}

// Vincular eventos aos botões da tabela de recebimentos
function inicializarEventosRecebimentos() {
  document.querySelectorAll('.btn-view-rec').forEach(btn => {
    btn.addEventListener('click', () => abrirModalDetalhesRecebimento(btn.dataset.id));
  });

  document.querySelectorAll('.btn-edit-rec').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditarRecebimento(btn.dataset.id));
  });
}

// Chame sempre após renderizar a tabela
renderizarRecebimentosPagina(recebimentosCurrentPage);
inicializarEventosRecebimentos();

function renderPaginationRecebimentos() {
    let container = document.getElementById('pagination-recebimentos');
    if (!container) {
        const nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Paginação Recebimentos');
        container = document.createElement('ul');
        container.id = 'pagination-recebimentos';
        container.className = 'pagination justify-content-end mt-2';
        nav.appendChild(container);

        const cardBody = document.querySelector('#tabela-recebimentos').closest('.card-body');
        if (cardBody) {
            cardBody.parentNode.insertBefore(nav, cardBody.nextSibling);
        }
    }

    container.innerHTML = '';

    const total = recebimentosTotalPages;
    const current = recebimentosCurrentPage;

    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${current === 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.innerHTML = '«';
    prevLi.appendChild(prevLink);

    prevLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (current > 1) renderizarRecebimentosPagina(current - 1);
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
            renderizarRecebimentosPagina(p);
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
        if (current < total) renderizarRecebimentosPagina(current + 1);
    });

    container.appendChild(nextLi);
}

function atualizarCardsResumoRecebimentos() {
    const data = Array.isArray(recebimentosData) ? recebimentosData : [];

    const elementos = {
        'total-pendente-rec': data.filter(r => r.status === 'PENDENTE').length,
        'total-andamento-rec': data.filter(r => r.status === 'EM_ANDAMENTO').length,
        'total-concluido-rec': data.filter(r => r.status === 'CONCLUIDO').length,
        'total-excecao-rec': data.filter(r => r.status === 'EXCECAO').length
    };

    Object.entries(elementos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    });
}

// ---------- Funções de Scanner ----------
function iniciarScannerModal() {
    scannerAtivo = true;
    const scannerArea = document.getElementById('scanner-area-modal');
    const scannerContainer = document.getElementById('scanner-container-modal');

    if (scannerArea) scannerArea.style.display = 'none';
    if (scannerContainer) scannerContainer.style.display = 'block';

    console.log("Scanner iniciado (simulação)");

    document.addEventListener('keypress', handleScannerKeypress);
}

function handleScannerKeypress(e) {
    if (scannerAtivo && e.key === 'Enter') {
        const input = document.getElementById('input-codigo-manual');
        if (input && input.value) {
            validarPedidoConferenciaPorCodigo(currentConferenciaId, input.value);
            input.value = '';
        }
    }
}

function pararScannerModal() {
    scannerAtivo = false;
    const scannerArea = document.getElementById('scanner-area-modal');
    const scannerContainer = document.getElementById('scanner-container-modal');

    if (scannerArea) scannerArea.style.display = 'block';
    if (scannerContainer) scannerContainer.style.display = 'none';

    document.removeEventListener('keypress', handleScannerKeypress);
    console.log("Scanner parado (simulação)");
}

function validarPedidoManual() {
    const input = document.getElementById('input-codigo-manual');
    if (input && input.value && currentConferenciaId) {
        validarPedidoConferenciaPorCodigo(currentConferenciaId, input.value);
        input.value = '';
    }
}

// ---------- Funções de Filtro e Busca ----------
async function aplicarFiltrosConferencias() {
    const filtros = {
        tipo: document.getElementById('filtro-tipo-conf').value,
        status: document.getElementById('filtro-status-conf').value,
        operador_id: document.getElementById('filtro-operador-conf').value,
        data: document.getElementById('filtro-data-conf').value
    };

    // Limpar filtros vazios
    Object.keys(filtros).forEach(key => {
        if (!filtros[key]) delete filtros[key];
    });

    filtrosAtuaisConferencias = filtros;
    modoBuscaConferencias = false;
    termoBuscaConferencias = '';

    await carregarConferencias(filtros, 1);
}

async function buscarConferencias() {
    const query = document.getElementById('filtro-busca-conf').value;
    if (!query) {
        // Se a busca estiver vazia, recarrega as conferências sem filtro
        modoBuscaConferencias = false;
        termoBuscaConferencias = '';
        await carregarConferencias({}, 1);
        return;
    }

    try {
        mostrarCarregamento(true);
        modoBuscaConferencias = true;
        termoBuscaConferencias = query;

        const data = await apiRequest('/conferencias/search', 'GET', null, { query, page: 1, limit: PAGE_SIZE });
        
        conferenciasData = data.conferencias || [];
        conferenciasTotalPages = data.totalPages || 1;
        conferenciasCurrentPage = data.currentPage || 1;

        renderizarConferenciasPagina(conferenciasCurrentPage);
        atualizarCardsResumoConferencias();
    } catch (error) {
        console.error('Erro na busca:', error);
        mostrarFeedback('Erro ao buscar conferências', 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function buscarConferenciasPagina(page = 1) {
    try {
        mostrarCarregamento(true);
        const data = await apiRequest('/conferencias/search', 'GET', null, { 
            query: termoBuscaConferencias, 
            page, 
            limit: PAGE_SIZE 
        });
        
        conferenciasData = data.conferencias || [];
        conferenciasTotalPages = data.totalPages || 1;
        conferenciasCurrentPage = data.currentPage || 1;

        renderizarConferenciasPagina(conferenciasCurrentPage);
        atualizarCardsResumoConferencias();
    } catch (error) {
        console.error('Erro na busca paginada:', error);
        mostrarFeedback('Erro ao carregar página', 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

function limparFiltrosConferencias() {
    document.getElementById('filtro-tipo-conf').value = '';
    document.getElementById('filtro-status-conf').value = '';
    document.getElementById('filtro-operador-conf').value = '';
    document.getElementById('filtro-data-conf').value = '';
    document.getElementById('filtro-busca-conf').value = '';

    filtrosAtuaisConferencias = {};
    modoBuscaConferencias = false;
    termoBuscaConferencias = '';

    carregarConferencias({}, 1);
}

// ---------- Inicialização ----------
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

function configurarEventos() {
    // Eventos de conferência
    document.addEventListener('click', function (e) {
        if (e.target.closest('.btn-view-conf')) {
            const id = e.target.closest('.btn-view-conf').dataset.id;
            abrirModalDetalhesConferencia(id);
        }

        if (e.target.closest('.btn-edit-conf')) {
            const id = e.target.closest('.btn-edit-conf').dataset.id;
            abrirModalEditarConferencia(id);
        }

        if (e.target.closest('.btn-concluir-conf')) {
            const id = e.target.closest('.btn-concluir-conf').dataset.id;
            concluirConferencia(id);
        }

        if (e.target.closest('.btn-delete-conf')) {
            const id = e.target.closest('.btn-delete-conf').dataset.id;
            excluirConferencia(id);
        }
    });

    // Eventos de recebimento
    document.addEventListener('click', function (e) {
        if (e.target.closest('.btn-view-rec')) {
            const id = e.target.closest('.btn-view-rec').dataset.id;
            abrirModalDetalhesRecebimento(id);
        }

        if (e.target.closest('.btn-edit-rec')) {
            const id = e.target.closest('.btn-edit-rec').dataset.id;
            abrirModalEditarRecebimento(id);
        }

        if (e.target.closest('.btn-concluir-rec')) {
            const id = e.target.closest('.btn-concluir-rec').dataset.id;
            concluirRecebimento(id);
        }

        if (e.target.closest('.btn-delete-rec')) {
            const id = e.target.closest('.btn-delete-rec').dataset.id;
            excluirRecebimento(id);
        }
    });

    // Scanner events
    const btnIniciarScanner = document.getElementById('btn-iniciar-scanner');
    const btnPararScanner = document.getElementById('btn-parar-scanner');
    const btnValidarManual = document.getElementById('btn-validar-manual');

    if (btnIniciarScanner) {
        btnIniciarScanner.addEventListener('click', iniciarScannerModal);
    }

    if (btnPararScanner) {
        btnPararScanner.addEventListener('click', pararScannerModal);
    }

    if (btnValidarManual) {
        btnValidarManual.addEventListener('click', validarPedidoManual);
    }

    // Event listeners para os formulários
    const formNovaConferencia = document.getElementById('form-nova-conferencia');
    const formNovoRecebimento = document.getElementById('form-novo-recebimento');
    
    if (formNovaConferencia) {
        formNovaConferencia.addEventListener('submit', salvarConferencia);
    }
    
    if (formNovoRecebimento) {
        formNovoRecebimento.addEventListener('submit', salvarRecebimento);
    }

    // Botões de adicionar pedidos
    const btnAddPedidoConferencia = document.getElementById('btn-add-pedido-conferencia');
    const btnAddPedidoRecebimento = document.getElementById('btn-add-pedido-recebimento');
    
    if (btnAddPedidoConferencia) {
        btnAddPedidoConferencia.addEventListener('click', adicionarPedidoConferencia);
    }
    
    if (btnAddPedidoRecebimento) {
        btnAddPedidoRecebimento.addEventListener('click', adicionarPedidoRecebimento);
    }

    // Mostrar/ocultar campo de número de transporte baseado no tipo
    const tipoSelect = document.getElementById('nova-conferencia-tipo');
    const campotransporte = document.getElementById('campo-numero-transporte');
    
    if (tipoSelect && campotransporte) {
        tipoSelect.addEventListener('change', function() {
            campotransporte.style.display = this.value === 'OUTBOUND' ? 'block' : 'none';
            if (this.value === 'OUTBOUND') {
                document.getElementById('nova-conferencia-numero-transporte').setAttribute('required', 'required');
            } else {
                document.getElementById('nova-conferencia-numero-transporte').removeAttribute('required');
            }
        });
    }

    // Eventos de filtro
    const btnFiltrar = document.getElementById('btn-filtrar');
    const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
    const btnBuscar = document.getElementById('btn-buscar-conf');

    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', aplicarFiltrosConferencias);
    }

    if (btnLimparFiltros) {
        btnLimparFiltros.addEventListener('click', limparFiltrosConferencias);
    }

    if (btnBuscar) {
        btnBuscar.addEventListener('click', buscarConferencias);
    }
}

// ---------- Funções auxiliares para modais ----------
async function abrirModalDetalhesConferencia(id) {
    try {
        const { conferencia, pedidos } = await carregarDetalhesConferencia(id);
        preencherModalDetalhesConferencia(conferencia, pedidos);

        const modalElement = document.getElementById('modal-detalhes-conferencia');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    } catch (error) {
        mostrarFeedback('Erro ao carregar detalhes da conferência', 'error');
    }
}

// ---------- Funções Globais ----------
window.filtrarConferenciasPorStatus = function (status) {
    document.getElementById('filtro-status-conf').value = status;
    aplicarFiltrosConferencias();
}

window.filtrarRecebimentosPorStatus = function (status) {
    const filtradas = recebimentosData.filter(r => r.status === status);
    recebimentosTotalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
    recebimentosCurrentPage = 1;
    renderizarRecebimentosPagina(recebimentosCurrentPage);
}

window.abrirModalNovaConferencia = function () {
    limparFormularioConferencia();
    const modalElement = document.getElementById('modal-nova-conferencia');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

window.abrirModalNovoRecebimento = function () {
    limparFormularioRecebimento();
    const modalElement = document.getElementById('modal-novo-recebimento');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

window.iniciarScanner = function () {
    alert('Scanner iniciado (simulação)');
    const scannerArea = document.getElementById('scanner-area');
    const scannerContainer = document.getElementById('scanner-container');

    if (scannerArea) scannerArea.style.display = 'none';
    if (scannerContainer) scannerContainer.style.display = 'block';
}

window.pararScanner = function () {
    alert('Scanner parado (simulação)');
    const scannerArea = document.getElementById('scanner-area');
    const scannerContainer = document.getElementById('scanner-container');

    if (scannerArea) scannerArea.style.display = 'block';
    if (scannerContainer) scannerContainer.style.display = 'none';
}

window.adicionarPedido = function () {
    const input = document.getElementById('input-codigo');
    if (input && input.value) {
        alert(`Pedido ${input.value} adicionado manualmente`);
        input.value = '';
    }
}

// Funções auxiliares para formulários
function limparFormularioConferencia() {
    const form = document.getElementById('form-nova-conferencia');
    if (form) {
        form.reset();

        // Limpar selects específicos
        const operadorSelect = document.getElementById('nova-conferencia-operador');
        if (operadorSelect) operadorSelect.selectedIndex = 0;

        const tipoSelect = document.getElementById('nova-conferencia-tipo');
        if (tipoSelect) tipoSelect.selectedIndex = 0;

        const estacaoSelect = document.getElementById('nova-conferencia-estacao');
        if (estacaoSelect) estacaoSelect.selectedIndex = 0;

        const transporteInput = document.getElementById('nova-conferencia-numero-transporte');
        if (transporteInput) transporteInput.value = '';

        // Limpar lista de pedidos
        const listaPedidos = document.getElementById('lista-pedidos-conf');
        if (listaPedidos) listaPedidos.innerHTML = '';

        // Resetar contador
        const contadorPedidos = document.getElementById('contador-pedidos-conf');
        if (contadorPedidos) contadorPedidos.textContent = '0';
    }
}

function limparFormularioRecebimento() {
    const form = document.getElementById('form-novo-recebimento');
    if (form) {
        form.reset();

        // Limpar selects específicos
        const operadorSelect = document.getElementById('novo-recebimento-operador');
        if (operadorSelect) operadorSelect.selectedIndex = 0;

        const metodoSelect = document.getElementById('novo-recebimento-metodo');
        if (metodoSelect) metodoSelect.selectedIndex = 0;

        const manifestoInput = document.getElementById('novo-recebimento-manifesto');
        if (manifestoInput) manifestoInput.value = '';

        // Limpar lista de pedidos
        const listaPedidos = document.getElementById('lista-pedidos-rec');
        if (listaPedidos) listaPedidos.innerHTML = '';

        // Resetar contador
        const contadorPedidos = document.getElementById('contador-pedidos-rec');
        if (contadorPedidos) contadorPedidos.textContent = '0';
    }
}

async function abrirModalEditarConferencia(id) {
    try {
        mostrarCarregamento(true);

        // Buscar dados da conferência
        const conferencia = await apiRequest(`/conferencias/${id}`, 'GET');

        // Preencher formulário de edição
        document.getElementById('editar-conferencia-id').value = conferencia.id;

        const operadorSelect = document.getElementById('editar-conferencia-operador');
        if (operadorSelect && conferencia.operador_id) {
            operadorSelect.value = conferencia.operador_id;
        }

        const tipoSelect = document.getElementById('editar-conferencia-tipo');
        if (tipoSelect && conferencia.tipo) {
            tipoSelect.value = conferencia.tipo;
        }

        const estacaoSelect = document.getElementById('editar-conferencia-estacao');
        if (estacaoSelect && conferencia.nome_estacao) {
            estacaoSelect.value = conferencia.nome_estacao;
        }

        const transporteInput = document.getElementById('editar-conferencia-transporte');
        if (transporteInput && conferencia.transporte_id) {
            transporteInput.value = conferencia.transporte_id;
        }

        // Buscar e preencher pedidos da conferência
        const pedidos = await apiRequest(`/conferencias/${id}/pedidos`, 'GET');
        const listaPedidos = document.getElementById('lista-pedidos-editar-conferencia');
        if (listaPedidos) {
            listaPedidos.innerHTML = '';

            if (Array.isArray(pedidos) && pedidos.length > 0) {
                pedidos.forEach(pedido => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';
                    li.innerHTML = `
                        ${pedido.codigo_pedido || pedido.id}
                        <span class="badge bg-primary rounded-pill">${pedido.produto || 'N/A'}</span>
                    `;
                    listaPedidos.appendChild(li);
                });

                // Atualizar contador
                const contador = document.getElementById('contador-pedidos-editar-conferencia');
                if (contador) contador.textContent = pedidos.length;
            } else {
                listaPedidos.innerHTML = '<li class="list-group-item text-center">Nenhum pedido encontrado</li>';
            }
        }

        // Abrir modal
        const modalElement = document.getElementById('modal-editar-conferencia');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    } catch (error) {
        console.error('Erro ao abrir modal de edição de conferência:', error);
        mostrarFeedback('Erro ao carregar dados da conferência', 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function abrirModalDetalhesRecebimento(id) {
    try {
        mostrarCarregamento(true);

        // Buscar dados do recebimento
        const recebimento = await apiRequest(`/recebimentos/${id}`, 'GET');
        const pedidos = await apiRequest(`/recebimentos/${id}/pedidos`, 'GET');

        // Preencher detalhes do recebimento
        document.getElementById('detalhe-id-rec-badge').textContent = `#${recebimento.id}`;

        const elementos = {
            'detalhe-metodo-rec': recebimento.metodo || '-',
            'detalhe-manifesto-rec': recebimento.numero_manifesto || '-',
            'detalhe-operador-rec': recebimento.operador_id || '-',
            'detalhe-total-pedidos-rec': recebimento.quantidade_pedidos || 0,
            'detalhe-criacao-rec': formatarData(recebimento.data_criacao)
        };

        Object.entries(elementos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.textContent = valor;
        });

        // Status
        const status = STATUS[recebimento.status] || { class: '', text: recebimento.status || '-' };
        const statusBadge = document.getElementById('detalhe-status-rec');
        if (statusBadge) {
            statusBadge.className = `badge ${status.class}`;
            statusBadge.textContent = status.text;
        }

        // Preencher tabela de pedidos
        const tbody = document.getElementById('detalhe-pedidos-rec');
        if (tbody) {
            tbody.innerHTML = '';

            if (Array.isArray(pedidos) && pedidos.length > 0) {
                pedidos.forEach(p => {
                    const statusPedido = STATUS_PEDIDO[p.status] || { class: '', text: p.status || '-' };

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${p.codigo_pedido || p.id || '-'}</td>
                        <td>${p.produto || p.produto_id || '-'}</td>
                        <td><span class="badge ${statusPedido.class}">${statusPedido.text}</span></td>
                        <td>${p.data_validacao ? formatarData(p.data_validacao) : '-'}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum pedido encontrado</td></tr>';
            }
        }

        // Configurar botão de concluir se aplicável
        const btnConcluir = document.getElementById('btn-concluir-rec');
        if (btnConcluir) {
            // Remover event listeners anteriores
            const newBtn = btnConcluir.cloneNode(true);
            btnConcluir.parentNode.replaceChild(newBtn, btnConcluir);

            if (recebimento.status !== 'CONCLUIDO') {
                newBtn.style.display = 'block';
                newBtn.addEventListener('click', async () => {
                    if (!confirm('Deseja concluir este recebimento?')) return;
                    await concluirRecebimento(recebimento.id);
                    const modal = document.getElementById('modal-detalhes-recebimento');
                    if (modal) bootstrap.Modal.getInstance(modal).hide();
                });
            } else {
                newBtn.style.display = 'none';
            }
        }

        // Abrir modal
        const modalElement = document.getElementById('modal-detalhes-recebimento');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    } catch (error) {
        console.error('Erro ao abrir modal de detalhes do recebimento:', error);
        mostrarFeedback('Erro ao carregar dados do recebimento', 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function abrirModalEditarRecebimento(id) {
    try {
        mostrarCarregamento(true);

        // Buscar dados do recebimento
        const recebimento = await apiRequest(`/recebimentos/${id}`, 'GET');
        const pedidos = await apiRequest(`/recebimentos/${id}/pedidos`, 'GET');

        // Preencher formulário de edição
        document.getElementById('editar-recebimento-id').value = recebimento.id;

        const operadorSelect = document.getElementById('editar-recebimento-operador');
        if (operadorSelect && recebimento.operador_id) {
            operadorSelect.value = recebimento.operador_id;
        }

        const metodoSelect = document.getElementById('editar-recebimento-metodo');
        if (metodoSelect && recebimento.metodo) {
            metodoSelect.value = recebimento.metodo;
        }

        const manifestoInput = document.getElementById('editar-recebimento-manifesto');
        if (manifestoInput && recebimento.numero_manifesto) {
            manifestoInput.value = recebimento.numero_manifesto;
        }

        // Preencher lista de pedidos
        const listaPedidos = document.getElementById('lista-pedidos-editar-recebimento');
        if (listaPedidos) {
            listaPedidos.innerHTML = '';

            if (Array.isArray(pedidos) && pedidos.length > 0) {
                pedidos.forEach(pedido => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';
                    li.innerHTML = `
                        ${pedido.codigo_pedido || pedido.id}
                        <span class='badge bg-primary rounded-pill'>${pedido.produto || 'N/A'}</span>
                    `;
                    listaPedidos.appendChild(li);
                });

                // Atualizar contador
                const contador = document.getElementById('contador-pedidos-editar-recebimento');
                if (contador) contador.textContent = pedidos.length;
            } else {
                listaPedidos.innerHTML = '<li class="list-group-item text-center">Nenhum pedido encontrado</li>';
            }
        }

        // Abrir modal
        const modalElement = document.getElementById('modal-editar-recebimento');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    } catch (error) {
        console.error('Erro ao abrir modal de edição de recebimento:', error);
        mostrarFeedback('Erro ao carregar dados do recebimento', 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function concluirRecebimento(id) {
    if (!confirm('Deseja concluir este recebimento?')) return;
    try {
        mostrarCarregamento(true);
        await apiRequest(`/recebimentos/${id}/concluir`, 'POST');
        mostrarFeedback('Recebimento concluído com sucesso!', 'success');
        await carregarRecebimentos({}, recebimentosCurrentPage);
    } catch (error) {
        console.error('Erro ao concluir recebimento:', error);
        mostrarFeedback('Erro ao concluir recebimento: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

async function excluirRecebimento(id) {
    if (!confirm('Deseja realmente excluir este recebimento?')) return;
    try {
        mostrarCarregamento(true);
        await apiRequest(`/recebimentos/${id}`, 'DELETE');
        mostrarFeedback('Recebimento excluído com sucesso!', 'success');
        await carregarRecebimentos({}, 1);
    } catch (error) {
        console.error('Erro ao excluir recebimento:', error);
        mostrarFeedback('Erro ao excluir recebimento: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

// Função para adicionar pedido à conferência (nova)
async function adicionarPedidoConferencia() {
    const input = document.getElementById('input-codigo-pedido-conf');
    if (!input || !input.value) return;

    const codigo = input.value.trim();
    if (!codigo) return;

    // Validar se o pedido existe
    if (!await validarPedidoExistente(codigo)) {
        mostrarFeedback(`Pedido ${codigo} não encontrado no sistema`, 'error');
        return;
    }

    const lista = document.getElementById('lista-pedidos-conf');
    const contador = document.getElementById('contador-pedidos-conf');
    const quantidadeInput = document.getElementById('nova-conferencia-quantidade');

    if (lista && contador && quantidadeInput) {
        // Verificar se o pedido já foi adicionado
        const pedidosExistentes = Array.from(lista.querySelectorAll('.pedido-item'))
            .map(item => item.textContent.split(' - ')[0].trim());

        if (pedidosExistentes.includes(codigo)) {
            mostrarFeedback('Pedido já adicionado à lista', 'warning');
            return;
        }

        // Adicionar à lista
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center pedido-item';
        li.innerHTML = `
            ${codigo} - A ser validado
            <button type="button" class="btn btn-sm btn-danger btn-remover-pedido">
                <i class="fas fa-times"></i>
            </button>
        `;

        lista.appendChild(li);

        // Atualizar contador e campo de quantidade
        const total = parseInt(contador.textContent) + 1;
        contador.textContent = total;
        quantidadeInput.value = total;

        // Adicionar evento de remoção
        const btnRemover = li.querySelector('.btn-remover-pedido');
        if (btnRemover) {
            btnRemover.addEventListener('click', function () {
                li.remove();
                const novoTotal = parseInt(contador.textContent) - 1;
                contador.textContent = novoTotal;
                quantidadeInput.value = novoTotal;
            });
        }

        // Limpar input
        input.value = '';
        input.focus();

        mostrarFeedback('Pedido adicionado à lista', 'success');
    }
}

// Função para adicionar pedido ao recebimento (novo)
async function adicionarPedidoRecebimento() {
    const input = document.getElementById('input-codigo-pedido-rec');
    if (!input || !input.value) return;

    const codigo = input.value.trim();
    if (!codigo) return;

    // Validar se o pedido existe
    if (!await validarPedidoExistente(codigo)) {
        mostrarFeedback(`Pedido ${codigo} não encontrado no sistema`, 'error');
        return;
    }

    const lista = document.getElementById('lista-pedidos-rec');
    const contador = document.getElementById('contador-pedidos-rec');
    const quantidadeInput = document.getElementById('novo-recebimento-quantidade');

    if (lista && contador && quantidadeInput) {
        // Verificar se o pedido já foi adicionado
        const pedidosExistentes = Array.from(lista.querySelectorAll('.pedido-item'))
            .map(item => item.textContent.split(' - ')[0].trim());

        if (pedidosExistentes.includes(codigo)) {
            mostrarFeedback('Pedido já adicionado à lista', 'warning');
            return;
        }

        // Adicionar à lista
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center pedido-item';
        li.innerHTML = `
            ${codigo} - A ser recebido
            <button type="button" class="btn btn-sm btn-danger btn-remover-pedido">
                <i class="fas fa-times"></i>
            </button>
        `;

        lista.appendChild(li);

        // Atualizar contador e campo de quantidade
        const total = parseInt(contador.textContent) + 1;
        contador.textContent = total;
        quantidadeInput.value = total;

        // Adicionar evento de remoção
        const btnRemover = li.querySelector('.btn-remover-pedido');
        if (btnRemover) {
            btnRemover.addEventListener('click', function () {
                li.remove();
                const novoTotal = parseInt(contador.textContent) - 1;
                contador.textContent = novoTotal;
                quantidadeInput.value = novoTotal;
            });
        }

        // Limpar input
        input.value = '';
        input.focus();

        mostrarFeedback('Pedido adicionado à lista', 'success');
    }
}

// Função para salvar conferência (nova ou edição)
async function salvarConferencia(e) {
    e.preventDefault();

    const form = e.target;
    const isEdit = form.id === 'form-editar-conferencia';
    const id = isEdit ? document.getElementById('editar-conferencia-id').value : null;

    try {
        mostrarCarregamento(true);

        // Coletar dados do formulário
        const formData = {
            operador_id: form.querySelector('#editar-conferencia-operador') ?
                form.querySelector('#editar-conferencia-operador').value :
                form.querySelector('#nova-conferencia-operador').value,
            tipo: form.querySelector('#editar-conferencia-tipo') ?
                form.querySelector('#editar-conferencia-tipo').value :
                form.querySelector('#nova-conferencia-tipo').value,
            nome_estacao: form.querySelector('#editar-conferencia-estacao') ?
                form.querySelector('#editar-conferencia-estacao').value :
                form.querySelector('#nova-conferencia-estacao').value
        };

        // Adicionar transporte_id apenas se for OUTBOUND
        if (formData.tipo === 'OUTBOUND') {
            formData.transporte_id = form.querySelector('#editar-conferencia-transporte') ?
                form.querySelector('#editar-conferencia-transporte').value :
                form.querySelector('#nova-conferencia-numero-transporte').value;
        }

        // Coletar pedidos
        const listaPedidos = document.getElementById(isEdit ?
            'lista-pedidos-editar-conferencia' : 'lista-pedidos-conf');

        if (listaPedidos) {
            const pedidos = Array.from(listaPedidos.querySelectorAll('.pedido-item'))
                .map(item => item.textContent.split(' - ')[0].trim());

            formData.pedidos = pedidos;
        }

        // Enviar requisição
        const endpoint = isEdit ? `/conferencias/${id}` : '/conferencias';
        const method = isEdit ? 'PUT' : 'POST';

        await apiRequest(endpoint, method, formData);

        // Feedback e fechar modal
        mostrarFeedback(`Conferência ${isEdit ? 'atualizada' : 'criada'} com sucesso!`, 'success');

        const modalElement = document.getElementById(isEdit ?
            'modal-editar-conferencia' : 'modal-nova-conferencia');

        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
        }

        // Recarregar dados
        await carregarConferencias(filtrosAtuaisConferencias, conferenciasCurrentPage);

    } catch (error) {
        console.error(`Erro ao ${isEdit ? 'editar' : 'criar'} conferência:`, error);
        
        // Verifica se é erro de pedido não encontrado
        if (error.message.includes('não encontrado')) {
            const pedidoNaoEncontrado = error.message.split(' ')[1];
            mostrarFeedback(`Erro: Pedido ${pedidoNaoEncontrado} não existe no sistema`, 'error');
        } else {
            mostrarFeedback(`Erro ao ${isEdit ? 'editar' : 'criar'} conferência: ${error.message}`, 'error');
        }
    } finally {
        mostrarCarregamento(false);
    }
}

// Função para salvar recebimento (novo ou edição)
async function salvarRecebimento(e) {
    e.preventDefault();

    const form = e.target;
    const isEdit = form.id === 'form-editar-recebimento';
    const id = isEdit ? document.getElementById('editar-recebimento-id').value : null;

    try {
        mostrarCarregamento(true);

        // Coletar dados do formulário
        const formData = {
            operador_id: form.querySelector('#editar-recebimento-operador') ?
                form.querySelector('#editar-recebimento-operador').value :
                form.querySelector('#novo-recebimento-operador').value,
            metodo: form.querySelector('#editar-recebimento-metodo') ?
                form.querySelector('#editar-recebimento-metodo').value :
                form.querySelector('#novo-recebimento-metodo').value,
            numero_manifesto: form.querySelector('#editar-recebimento-manifesto') ?
                form.querySelector('#editar-recebimento-manifesto').value :
                form.querySelector('#novo-recebimento-manifesto').value
        };

        // Coletar pedidos
        const listaPedidos = document.getElementById(isEdit ?
            'lista-pedidos-editar-recebimento' : 'lista-pedidos-rec');

        if (listaPedidos) {
            const pedidos = Array.from(listaPedidos.querySelectorAll('.pedido-item'))
                .map(item => item.textContent.split(' - ')[0].trim());

            formData.pedidos = pedidos;
        }

        // Enviar requisição
        const endpoint = isEdit ? `/recebimentos/${id}` : '/recebimentos';
        const method = isEdit ? 'PUT' : 'POST';

        await apiRequest(endpoint, method, formData);

        // Feedback e fechar modal
        mostrarFeedback(`Recebimento ${isEdit ? 'atualizado' : 'criado'} com sucesso!`, 'success');

        const modalElement = document.getElementById(isEdit ?
            'modal-editar-recebimento' : 'modal-novo-recebimento');

        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
        }

        // Recarregar dados
        await carregarRecebimentos({}, recebimentosCurrentPage);

    } catch (error) {
        console.error(`Erro ao ${isEdit ? 'editar' : 'criar'} recebimento:`, error);
        
        // Verifica se é erro de pedido não encontrado
        if (error.message.includes('não encontrado')) {
            const pedidoNaoEncontrado = error.message.split(' ')[1];
            mostrarFeedback(`Erro: Pedido ${pedidoNaoEncontrado} não existe no sistema`, 'error');
        } else {
            mostrarFeedback(`Erro ao ${isEdit ? 'editar' : 'criar'} recebimento: ${error.message}`, 'error');
        }
    } finally {
        mostrarCarregamento(false);
    }
}

// ---------- Função para associar pedido a operação (RECEBIMENTO, TRANSFERENCIA, CONFERENCIA) ----------
async function associarOperacao(pedidoId, operacaoId, tipoOperacao) {
    try {
        mostrarCarregamento(true);
        
        let endpoint;
        if (tipoOperacao === 'recebimento') {
            endpoint = `/pedidos/recebimentos/${operacaoId}/associar-pedido`;
        } else if (tipoOperacao === 'transferencia') {
            endpoint = `/pedidos/transferencias/${operacaoId}/associar-pedido`;
        } else if (tipoOperacao === 'conferencia') {
            endpoint = `/pedidos/conferencias/${operacaoId}/associar-pedido`;
        } else {
            throw new Error('Tipo de operação inválido');
        }

        // Usar apiRequest que inclui autenticação e envia no formato correto
        await apiRequest(endpoint, 'POST', { pedidoId: Number(pedidoId) });
        
        mostrarFeedback('Pedido associado com sucesso!', 'success');
        return true;
    } catch (error) {
        console.error('Erro ao associar pedido:', error);
        mostrarFeedback('Erro ao associar pedido: ' + error.message, 'error');
        return false;
    } finally {
        mostrarCarregamento(false);
    }
}

// ---------- Funções para chamadas globais (para uso em outros arquivos) ----------
window.associarOperacao = associarOperacao;
window.adicionarPedidoConferencia = adicionarPedidoConferencia;
window.adicionarPedidoRecebimento = adicionarPedidoRecebimento;
window.validarPedidoManual = validarPedidoManual;
window.iniciarScannerModal = iniciarScannerModal;
window.pararScannerModal = pararScannerModal;