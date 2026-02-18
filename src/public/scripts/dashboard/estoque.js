let estoqueData = [];
let produtosData = [];
let hubsData = [];
let estoqueAtual = null;
const API_BASE = (window.API_BASE && window.API_BASE) || '';

document.addEventListener('DOMContentLoaded', function () {
    if (!verificarAutenticacao()) return;
    configurarEventos();
    carregarDadosIniciais();
    preencherUsuarioHeader();
});

function preencherUsuarioHeader() {
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
}

// ---------------------- API helpers ----------------------
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
        const base = API_BASE || '';
        const url = new URL(base + path, window.location.origin);
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

// ---------------------- Usuario ID helpers ----------------------
function getUsuarioId() {
    try {
        // Primeira tentativa: userData do localStorage
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        if (userData.id && !isNaN(Number(userData.id))) {
            return Number(userData.id);
        }

        // Fallback: decodificar JWT
        const token = localStorage.getItem('token');
        if (token) {
            const payload = token.split('.')[1];
            if (payload) {
                const decoded = JSON.parse(atob(payload));
                const userId = decoded.sub || decoded.id || decoded.userId;
                if (userId && !isNaN(Number(userId))) {
                    return Number(userId);
                }
            }
        }
    } catch (error) {
        console.warn('Erro ao obter usuario_id:', error);
    }
    return null;
}

function attachUsuario(obj) {
    const usuarioId = getUsuarioId();
    if (usuarioId !== null) {
        obj.usuario_id = usuarioId;
    }
    return obj;
}

// ---------------------- Inicialização ----------------------
async function carregarDadosIniciais() {
    try {
        const [estoques, produtos, hubsResp] = await Promise.all([
            apiRequest('/estoques'),
            apiRequest('/produtos'),
            apiRequest('/hubs')
        ]);

        estoqueData = Array.isArray(estoques) ? estoques : [];
        produtosData = Array.isArray(produtos) ? produtos : [];

        if (Array.isArray(hubsResp)) {
            hubsData = hubsResp;
        } else if (hubsResp && Array.isArray(hubsResp.hubs)) {
            hubsData = hubsResp.hubs;
        } else {
            hubsData = [];
        }

        atualizarFiltros();
        atualizarResumo();
        renderizarTabela(estoqueData);
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        const container = document.getElementById('tabela-estoque');
        if (container) container.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Erro ao carregar dados</td></tr>';
    }
}

// ---------------------- UI / Filtros ----------------------
function atualizarFiltros() {
    // Hub filter
    const filtroHub = document.getElementById('filtro-hub');
    if (filtroHub) {
        filtroHub.innerHTML = '<option value="">Todos</option>';
        hubsData.forEach(hub => {
            const opt = document.createElement('option');
            opt.value = hub.id;
            opt.textContent = `${hub.nome}${hub.codigo_hub ? ` (${hub.codigo_hub})` : ''}`;
            filtroHub.appendChild(opt);
        });
    }

    // Produto filter
    const filtroProduto = document.getElementById('filtro-produto');
    if (filtroProduto) {
        filtroProduto.innerHTML = '<option value="">Todos</option>';
        produtosData.forEach(prod => {
            const opt = document.createElement('option');
            opt.value = prod.id;
            opt.textContent = prod.nome;
            filtroProduto.appendChild(opt);
        });
    }

    // Modal Novo Item selects
    const selectProduto = document.getElementById('produto-id');
    if (selectProduto) {
        selectProduto.innerHTML = '';
        produtosData.forEach(prod => {
            const opt = document.createElement('option');
            opt.value = prod.id;
            opt.textContent = prod.nome;
            selectProduto.appendChild(opt);
        });
    }

    const selectHub = document.getElementById('hub-id');
    if (selectHub) {
        selectHub.innerHTML = '';
        hubsData.forEach(hub => {
            const opt = document.createElement('option');
            opt.value = hub.id;
            opt.textContent = hub.nome;
            selectHub.appendChild(opt);
        });
    }

    // Movimento modal: item list is list of estoque records
    const selectItem = document.getElementById('item-id');
    if (selectItem) {
        selectItem.innerHTML = '';
        estoqueData.forEach(item => {
            const produto = produtosData.find(p => p.id === item.produto_id) || {};
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = `${produto.nome || 'Produto'} — ${item.localizacao || 'Local'}`;
            selectItem.appendChild(opt);
        });
    }

    // Hubs for movement transfer select
    const hubOrigem = document.getElementById('hub-origem');
    const hubDestino = document.getElementById('hub-destino');
    if (hubOrigem) hubOrigem.innerHTML = '<option value="">Selecione</option>';
    if (hubDestino) hubDestino.innerHTML = '<option value="">Selecione</option>';
    hubsData.forEach(hub => {
        const o1 = document.createElement('option');
        o1.value = hub.id; o1.textContent = hub.nome;
        if (hubOrigem) hubOrigem.appendChild(o1);
        const o2 = document.createElement('option');
        o2.value = hub.id; o2.textContent = hub.nome;
        if (hubDestino) hubDestino.appendChild(o2);
    });
}

function aplicarFiltros() {
    const hubId = document.getElementById('filtro-hub')?.value;
    const produtoId = document.getElementById('filtro-produto')?.value;
    const status = document.getElementById('filtro-status')?.value;

    let dadosFiltrados = [...estoqueData];
    if (hubId) dadosFiltrados = dadosFiltrados.filter(i => String(i.hub_id) === String(hubId));
    if (produtoId) dadosFiltrados = dadosFiltrados.filter(i => String(i.produto_id) === String(produtoId));
    if (status) {
        dadosFiltrados = dadosFiltrados.filter(i => computeStatus(i) === status);
    }
    renderizarTabela(dadosFiltrados);
}

function filtrarPorHub(hubId) {
    const filtro = document.getElementById('filtro-hub');
    if (filtro) filtro.value = hubId || '';
    aplicarFiltros();
}

function filtrarPorStatus(status) {
    const filtro = document.getElementById('filtro-status');
    if (filtro) filtro.value = status || '';
    aplicarFiltros();
}

// ---------------------- Resumo ----------------------
function atualizarResumo() {
    const totalItens = estoqueData.reduce((acc, item) => acc + Number(item.quantidade_total || 0), 0);
    const totalDisponivel = estoqueData.filter(i => (Number(i.quantidade_total || 0) - Number(i.quantidade_reservada || 0)) > 0).length;
    const totalReservado = estoqueData.reduce((acc, item) => acc + Number(item.quantidade_reservada || 0), 0);
    const totalBaixo = estoqueData.filter(i => {
        const produto = produtosData.find(p => p.id === i.produto_id) || {};
        const min = produto.estoque_minimo ?? 0;
        return (Number(i.quantidade_total || 0) - Number(i.quantidade_reservada || 0)) <= min;
    }).length;

    const totalItensElem = document.getElementById('total-itens');
    const totalDisponivelElem = document.getElementById('total-disponivel');
    const totalReservadoElem = document.getElementById('total-reservado');
    const totalBaixoElem = document.getElementById('total-baixo');

    if (totalItensElem) totalItensElem.textContent = totalItens;
    if (totalDisponivelElem) totalDisponivelElem.textContent = totalDisponivel;
    if (totalReservadoElem) totalReservadoElem.textContent = totalReservado;
    if (totalBaixoElem) totalBaixoElem.textContent = totalBaixo;
}

// ---------------------- Tabela / Render ----------------------
function computeStatus(item) {
    const disponivel = Number(item.quantidade_total || 0) - Number(item.quantidade_reservada || 0);
    const produto = produtosData.find(p => p.id === item.produto_id) || {};
    const min = produto.estoque_minimo ?? 0;
    if (disponivel <= min) return 'ESTOQUE_BAIXO';
    if (Number(item.quantidade_reservada || 0) > 0) return 'RESERVADO';
    return 'DISPONIVEL';
}

function renderizarTabela(dados) {
    const tbody = document.getElementById('tabela-estoque');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!dados || dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum item encontrado</td></tr>';
        return;
    }

    dados.forEach(item => {
        const produto = produtosData.find(p => p.id === item.produto_id) || {};
        const hub = hubsData.find(h => h.id === item.hub_id) || {};
        const disponivel = Number(item.quantidade_total || 0) - Number(item.quantidade_reservada || 0);
        const status = computeStatus(item);

        const statusClass = {
            'DISPONIVEL': 'badge-success',
            'RESERVADO': 'badge-warning',
            'ESTOQUE_BAIXO': 'badge-danger'
        }[status] || 'badge-secondary';

        const rowClass = {
            'DISPONIVEL': 'stock-high',
            'RESERVADO': 'stock-medium',
            'ESTOQUE_BAIXO': 'stock-low'
        }[status] || '';

        const tr = document.createElement('tr');
        tr.className = rowClass;
        tr.style.cursor = 'pointer';
        tr.onclick = () => verDetalhesItem(item.id);

        tr.innerHTML = `
            <td>
                <strong>${produto.nome || 'Produto não encontrado'}</strong><br>
                <small class="text-muted">${(produto.descricao || '').substring(0, 80)}${(produto.descricao || '').length > 80 ? '...' : ''}</small>
            </td>
            <td>${item.localizacao || '-'}</td>
            <td>${hub.nome || '-'}</td>
            <td>${item.quantidade_total ?? 0} (disp: ${disponivel})</td>
            <td>${item.pedido_id ? '#' + item.pedido_id : '-'}</td>
            <td>${item.data_entrada ? formatDate(item.data_entrada) : '-'}</td>
            <td><span class="badge ${statusClass}">${status}</span></td>
            <td class="table-actions">
                <button class="btn btn-sm btn-info" onclick="event.stopPropagation(); verDetalhesItem(${item.id})"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); abrirModalMovimentacaoComItem(${item.id})"><i class="fas fa-exchange-alt"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ---------------------- Detalhes ----------------------
async function verDetalhesItem(itemId) {
    try {
        const resp = await apiRequest(`/estoques/${itemId}`);
        estoqueAtual = resp;
        preencherModalDetalhes(resp);
        $('#modal-detalhes').modal('show');
    } catch (error) {
        console.error('Erro ao buscar item:', error);
        alert('Erro ao carregar detalhes do item');
    }
}

function preencherModalDetalhes(item) {
    const produto = produtosData.find(p => p.id === item.produto_id) || {};
    const hub = hubsData.find(h => h.id === item.hub_id) || {};

    const imagemElem = document.getElementById('detalhe-imagem');
    const produtoElem = document.getElementById('detalhe-produto');
    const codigoElem = document.getElementById('detalhe-codigo');
    const localizacaoElem = document.getElementById('detalhe-localizacao');
    const hubElem = document.getElementById('detalhe-hub');
    const quantidadeElem = document.getElementById('detalhe-quantidade');
    const entradaElem = document.getElementById('detalhe-entrada');
    const saidaElem = document.getElementById('detalhe-saida');

    if (imagemElem) imagemElem.src = produto.imagem_url || 'https://via.placeholder.com/200';
    if (produtoElem) produtoElem.textContent = produto.nome || '—';
    if (codigoElem) codigoElem.textContent = produto.codigo || 'N/A';
    if (localizacaoElem) localizacaoElem.textContent = item.localizacao || '-';
    if (hubElem) hubElem.textContent = hub.nome || '-';
    if (quantidadeElem) quantidadeElem.textContent = `${item.quantidade_total ?? 0} (reservado: ${item.quantidade_reservada ?? 0})`;
    if (entradaElem) entradaElem.textContent = item.data_entrada ? formatDate(item.data_entrada) : '-';
    if (saidaElem) saidaElem.textContent = item.data_saida ? formatDate(item.data_saida) : '-';

    loadHistoricoMovimentacoes(item);
}

async function loadHistoricoMovimentacoes(item) {
    const tbody = document.getElementById('detalhe-historico');
    if (!tbody) return;
    tbody.innerHTML = '';
    try {
        let movimentos = [];
        try {
            movimentos = await apiRequest(`/estoques/${item.id}/movimentacoes`);
        } catch (err) {
            movimentos = await apiRequest(`/estoque/movimentacao?produto_id=${item.produto_id}&hub_id=${item.hub_id}`);
        }

        if (!Array.isArray(movimentos) || movimentos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Sem histórico</td></tr>';
            return;
        }

        movimentos.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${m.data ? formatDate(m.data) : (m.createdAt ? formatDate(m.createdAt) : '-')}</td>
                <td>${m.tipo || m.tipo_movimentacao || '-'}</td>
                <td>${m.quantidade ?? '-'}</td>
                <td>${m.usuario_nome || m.usuario_id || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.warn('Erro ao carregar histórico (ignorável se endpoint não existir):', error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Histórico indisponível</td></tr>';
    }
}

// ---------------------- Movimentações / CRUD ----------------------
function abrirModalMovimentacaoComItem(itemId) {
    $('#modal-movimentacao').modal('show');
    setTimeout(() => {
        const selectItem = document.getElementById('item-id');
        if (selectItem) selectItem.value = itemId;
        const item = estoqueData.find(i => i.id === Number(itemId));
        if (item) {
            const hubOrigem = document.getElementById('hub-origem');
            if (hubOrigem) hubOrigem.value = item.hub_id;
        }
    }, 120);
}

async function salvarItem() {
    try {
        const produto_id = Number(document.getElementById('produto-id')?.value);
        const hub_id = Number(document.getElementById('hub-id')?.value);
        const localizacao = document.getElementById('localizacao')?.value;
        const quantidade = Number(document.getElementById('quantidade')?.value);
        const pedido_id_raw = document.getElementById('pedido-id')?.value;
        const pedido_id = pedido_id_raw ? Number(pedido_id_raw) : null;
        const data_entrada_raw = document.getElementById('data-entrada')?.value;
        const data_entrada = data_entrada_raw ? new Date(data_entrada_raw).toISOString() : new Date().toISOString();

        if (!produto_id || !hub_id || !quantidade) {
            alert('Produto, Hub e Quantidade são obrigatórios');
            return;
        }

        toggleLoading(document.querySelector('#modal-novo-item .btn-primary'), true);

        const body = attachUsuario({
            produto_id,
            hub_id,
            quantidade,
            localizacao: localizacao || null,
            referencia: pedido_id ? `PEDIDO_${pedido_id}` : `MANUAL_ENTRY`,
            pedido_id,
            data_entrada
        });

        const resp = await apiRequest('/estoques/entrada', 'POST', body);
        alert('Entrada registrada com sucesso');
        $('#modal-novo-item').modal('hide');
        await carregarDadosIniciais();
    } catch (error) {
        console.error('Erro ao salvar item:', error);
        alert('Erro ao salvar item: ' + (error.message || error));
    } finally {
        toggleLoading(document.querySelector('#modal-novo-item .btn-primary'), false);
    }
}

async function salvarMovimentacao() {
    try {
        const tipo = document.getElementById('tipo-movimentacao')?.value;
        const itemId = document.getElementById('item-id')?.value;
        const quantidade = Number(document.getElementById('quantidade-mov')?.value);
        const motivo = document.getElementById('motivo')?.value || null;
        const hubOrigemId = document.getElementById('hub-origem')?.value || null;
        const hubDestinoId = document.getElementById('hub-destino')?.value || null;

        if (!tipo || !itemId || !quantidade) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        toggleLoading(document.querySelector('#modal-movimentacao .btn-primary'), true);

        const estoqueItem = estoqueData.find(i => String(i.id) === String(itemId));
        if (!estoqueItem) throw new Error('Item de estoque não encontrado');

        if (tipo === 'ENTRADA') {
            await apiRequest('/estoques/entrada', 'POST', attachUsuario({
                produto_id: estoqueItem.produto_id,
                hub_id: hubOrigemId ? Number(hubOrigemId) : estoqueItem.hub_id,
                quantidade,
                localizacao: estoqueItem.localizacao || null,
                referencia: `MOV_ENTRADA_${Date.now()}`,
            }));
            alert('Entrada registrada');
        } else if (tipo === 'RESERVA') {
            await apiRequest('/estoques/reservar', 'POST', attachUsuario({
                produto_id: estoqueItem.produto_id,
                hub_id: hubOrigemId ? Number(hubOrigemId) : estoqueItem.hub_id,
                quantidade,
                localizacao: estoqueItem.localizacao || null,
                referencia: `MOV_RESERVA_${Date.now()}`,
            }));
            alert('Reserva registrada');
        } else if (tipo === 'LIBERAR') {
            await apiRequest('/estoques/liberar-reserva', 'POST', attachUsuario({
                produto_id: estoqueItem.produto_id,
                hub_id: estoqueItem.hub_id,
                quantidade,
                referencia: `MOV_LIBERACAO_${Date.now()}`,
                consumirReservas: true
            }));
            alert('Saída registrada');
            } else if (tipo === 'SAIDA') {
            await apiRequest('/estoques/saida', 'POST', attachUsuario({
                produto_id: estoqueItem.produto_id,
                hub_id: estoqueItem.hub_id,
                quantidade,
                referencia: `MOV_SAIDA_${Date.now()}`,
                consumirReservas: true
            }));
            alert('Saída registrada');        } else if (tipo === 'TRANSFERENCIA') {
            if (!hubDestinoId) {
                alert('Selecione hub destino');
                return;
            }
            await apiRequest('/estoques/transferir', 'POST', attachUsuario({
                produto_id: estoqueItem.produto_id,
                origem_hub_id: Number(hubOrigemId || estoqueItem.hub_id),
                destino_hub_id: Number(hubDestinoId),
                quantidade,
                referencia: `MOV_TRANSFER_${Date.now()}`
            }));
            alert('Transferência registrada');
        } else {
            throw new Error('Tipo de movimentação inválido');
        }

        $('#modal-movimentacao').modal('hide');
        await carregarDadosIniciais();
    } catch (error) {
        console.error('Erro ao registrar movimentação:', error);
        alert('Erro ao registrar movimentação: ' + (error.message || error));
    } finally {
        toggleLoading(document.querySelector('#modal-movimentacao .btn-primary'), false);
    }
}

// ---------------------- Eventos / Util ----------------------
function configurarEventos() {
    const tipoMov = document.getElementById('tipo-movimentacao');
    if (tipoMov) {
        tipoMov.addEventListener('change', () => {
            const tipo = tipoMov.value;
            const grupo = document.getElementById('grupo-hub-destino');
            if (grupo) grupo.style.display = tipo === 'TRANSFERENCIA' ? 'block' : 'none';
        });
    }

    const btnSalvarItem = document.querySelector('#modal-novo-item .btn-primary');
    if (btnSalvarItem) btnSalvarItem.addEventListener('click', salvarItem);

    const btnSalvarMov = document.querySelector('#modal-movimentacao .btn-primary');
    if (btnSalvarMov) btnSalvarMov.addEventListener('click', salvarMovimentacao);

    const btnFiltrar = document.querySelector('button[onclick="aplicarFiltros()"]');
    if (btnFiltrar) btnFiltrar.addEventListener('click', aplicarFiltros);
}

function formatDate(d) {
    try {
        return new Date(d).toLocaleString();
    } catch (e) {
        return String(d || '-');
    }
}

function toggleLoading(button, isLoading) {
    if (!button) return;
    if (isLoading) {
        button.disabled = true;
        const btnText = button.querySelector('.btn-text');
        const loading = button.querySelector('.loading');
        if (btnText) btnText.style.display = 'none';
        if (loading) loading.style.display = 'inline-block';
    } else {
        button.disabled = false;
        const btnText = button.querySelector('.btn-text');
        const loading = button.querySelector('.loading');
        if (btnText) btnText.style.display = 'inline-block';
        if (loading) loading.style.display = 'none';
    }
}

function verificarAutenticacao() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// expose some functions to global scope used by inline onclick handlers
window.filtrarPorHub = filtrarPorHub;
window.filtrarPorStatus = filtrarPorStatus;
window.verDetalhesItem = verDetalhesItem;
window.abrirModalMovimentacaoComItem = abrirModalMovimentacaoComItem;
window.aplicarFiltros = aplicarFiltros;