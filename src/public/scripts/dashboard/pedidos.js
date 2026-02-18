const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8080'
    : 'https://logistics-xpress.vercel.app/';
const PAGE_SIZE = 10;
// Estado global
let pedidosData = [];
let pedidosCurrentPage = 1;
let pedidosTotalPages = 1;
let clientes = [];
let enderecos = [];
let produtos = [];
let filtrosAtuais = {};
let pedidoDetalhado = null;

async function apiFetch(urlOrPath, options = {}) {
    let finalUrl;
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
        finalUrl = urlOrPath;
    } else {
        const base = API_BASE_URL.replace(/\/$/, '');
        const path = urlOrPath.replace(/^\//, '');
        finalUrl = `${base}/${path}`;
    }

    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    try {
        const response = await fetch(finalUrl, {
            ...options,
            headers
        });

        if (response.status === 204) {
            return {
                ok: true,
                data: null,
                status: 204
            };
        }

        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
            return {
                ok: false,
                data: { message: 'Não autorizado' },
                status: 401
            };
        }

        return {
            ok: response.ok,
            data: data,
            status: response.status
        };

    } catch (err) {
        console.error('Erro na requisição:', err);
        return {
            ok: false,
            data: { message: 'Erro de conexão: ' + err.message },
            status: 0
        };
    }
}

async function apiRequest(path, method = 'GET', data = null, query = null) {
    try {
        const base = API_BASE_URL.replace(/\/$/, '');
        const cleanPath = path.replace(/^\//, '');
        let url = `${base}/${cleanPath}`;

        if (query && typeof query === 'object') {
            const urlObj = new URL(url);
            Object.entries(query).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    urlObj.searchParams.append(key, value);
                }
            });
            url = urlObj.toString();
        }

        const options = { method };
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        const result = await apiFetch(url, options);

        if (!result.ok) {
            let errorMessage = result.data?.error || result.data?.message || `Erro ${result.status}`;
            if (result.data?.details) {
                errorMessage += `: ${result.data.details}`;
            }
            throw new Error(errorMessage);
        }

        return result.data;

    } catch (err) {
        console.error('API request error:', path, err);
        throw err;
    }
}

async function apiGet(path, query = {}) {
    return apiRequest(path, 'GET', null, query);
}

async function apiPost(path, body) {
    return apiRequest(path, 'POST', body);
}

async function apiPut(path, body) {
    return apiRequest(path, 'PUT', body);
}

async function apiDelete(path) {
    return apiRequest(path, 'DELETE');
}

async function fetchNotaByPedido(pedidoId) {
    try {
        const pedido = pedidosData.find(p => p.id == pedidoId) || pedidoDetalhado;
        
        let notas = [];
        
        if (pedido && pedido.nota) {
            if (Array.isArray(pedido.nota)) {
                notas = pedido.nota;
            } else {
                notas = [pedido.nota];
            }
        } else {
            try {
                const notaData = await apiGet(`/notasFiscais/by-pedido/${pedidoId}`);
                if (notaData) {
                    if (Array.isArray(notaData)) {
                        notas = notaData;
                    } else {
                        notas = [notaData];
                    }
                }
            } catch (error) {
                if (error.message.includes('404')) {
                    console.warn('Nota fiscal não encontrada via endpoint específico');
                } else {
                    console.warn('Erro ao buscar nota fiscal:', error.message);
                }
            }
        }

        for (let nota of notas) {
            if (nota.id && (!nota.notaItens || !nota.itens)) {
                try {
                    const itens = await apiGet(`/notasFiscais/${nota.id}/itens`);
                    nota.itens = itens;
                } catch (error) {
                    console.warn('Erro ao buscar itens da nota:', error.message);
                }
            }
        }

        return notas.length > 0 ? notas : null;

    } catch (error) {
        console.error('Erro ao buscar nota fiscal:', error);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    carregarDadosIniciais();
    configurarEventos();
});

async function carregarDadosIniciais() {
    try {
        mostrarCarregamento(true);
        
        [clientes, produtos] = await Promise.all([
            apiGet('/clientes'),
            apiGet('/produtos')
        ]);
        
        popularSelectClientes();
        popularSelectProdutos();
        
        await carregarPedidos({}, 1);
        
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        mostrarErro('Erro ao carregar dados iniciais: ' + error.message);
    } finally {
        mostrarCarregamento(false);
    }
}

function popularSelectClientes() {
    const selects = [
        '#novo-pedido-cliente', 
        '#editar-pedido-cliente', 
        '#filtro-cliente'
    ];
    
    selects.forEach(selectId => {
        const select = document.querySelector(selectId);
        if (select) {
            select.innerHTML = '<option value="">Selecione um cliente</option>';
            clientes.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id;
                option.textContent = cliente.nome;
                select.appendChild(option);
            });
        }
    });
}

function popularSelectProdutos() {
    if (!Array.isArray(produtos)) {
        console.warn('Produtos não é um array:', produtos);
        produtos = [];
    }

    const optionsHtml = produtos.map(prod =>
        `<option value="${prod.id}" data-preco="${prod.preco ?? 0}">
            ${escapeHtml(prod.nome)} - ${formatarMoeda(prod.preco ?? 0)}
        </option>`
    ).join('');

    document.querySelectorAll('.select-produto').forEach(select => {
        select.innerHTML = '<option value="">Selecione um produto</option>' + optionsHtml;
    });
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
}

function configurarEventos() {
    const novoClienteSelect = document.getElementById('novo-pedido-cliente');
    const editarClienteSelect = document.getElementById('editar-pedido-cliente');
    
    if (novoClienteSelect) {
        novoClienteSelect.addEventListener('change', function() {
            carregarEnderecosCliente(this.value, 'novo-pedido-endereco');
        });
    }
    
    if (editarClienteSelect) {
        editarClienteSelect.addEventListener('change', function() {
            carregarEnderecosCliente(this.value, 'editar-pedido-endereco');
        });
    }
    
    const inputBusca = document.getElementById('input-busca');
    if (inputBusca) {
        inputBusca.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') buscarPedidos();
        });
    }
    
    const filtroStatus = document.getElementById('filtro-status');
    const filtroCliente = document.getElementById('filtro-cliente');
    const filtroDataInicio = document.getElementById('filtro-data-inicio');
    const filtroDataFim = document.getElementById('filtro-data-fim');
    
    if (filtroStatus) filtroStatus.addEventListener('change', aplicarFiltros);
    if (filtroCliente) filtroCliente.addEventListener('change', aplicarFiltros);
    if (filtroDataInicio) filtroDataInicio.addEventListener('change', aplicarFiltros);
    if (filtroDataFim) filtroDataFim.addEventListener('change', aplicarFiltros);
    
    // Event listeners para nota fiscal - NOVO
    const gerarNotaNovo = document.getElementById('novo-pedido-gerar-nota');
    if (gerarNotaNovo) {
        gerarNotaNovo.addEventListener('change', function() {
            toggleSecaoNotaFiscal('novo');
        });
    }
    
    // Event listeners para nota fiscal - EDITAR
    const gerarNotaEditar = document.getElementById('editar-pedido-gerar-nota');
    if (gerarNotaEditar) {
        gerarNotaEditar.addEventListener('change', function() {
            toggleSecaoNotaFiscal('editar');
        });
    }
}

async function carregarEnderecosCliente(clienteId, selectId) {
    if (!clienteId) return;
    
    try {
        const enderecos = await apiGet(`/enderecos?cliente_id=${clienteId}`);
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Selecione um endereço</option>';
            
            enderecos.forEach(endereco => {
                const option = document.createElement('option');
                option.value = endereco.id;
                option.textContent = `${endereco.rua}, ${endereco.numero} - ${endereco.cidade}/${endereco.estado}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar endereços:', error);
    }
}

async function carregarPedidos(filtros = {}, page = 1) {
    try {
        mostrarCarregamento(true);
        filtrosAtuais = { ...filtros };
        
        const pageSize = document.getElementById('filtro-limit')?.value || PAGE_SIZE;
        const params = { 
            ...filtros, 
            page, 
            size: pageSize 
        };
        
        if (params.termoBusca) {
            params.search = params.termoBusca;
            delete params.termoBusca;
        }
        
        Object.keys(params).forEach(key => {
            if (!params[key]) delete params[key];
        });
        
        const response = await apiGet('/pedidos', params);
        
        if (response.pedidos !== undefined) {
            pedidosData = Array.isArray(response.pedidos) ? response.pedidos : [];
            pedidosTotalPages = response.totalPages || 1;
            pedidosCurrentPage = response.currentPage || page;
        } else {
            pedidosData = Array.isArray(response) ? response : [];
            const totalItems = pedidosData.length;
            pedidosTotalPages = Math.max(1, Math.ceil(totalItems / pageSize));
            pedidosCurrentPage = page;
        }
        
        renderizarPedidos();
        await carregarContadoresTotais(filtros);
        
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        const tbody = document.getElementById('tabela-pedidos');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center text-danger">Erro ao carregar dados</td></tr>';
        }
    } finally {
        mostrarCarregamento(false);
    }
}

function renderizarPedidos() {
    const tbody = document.getElementById('tabela-pedidos');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!Array.isArray(pedidosData) || pedidosData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">Nenhum pedido encontrado</td></tr>';
        renderizarPaginacaoPedidos();
        return;
    }

    pedidosData.forEach(pedido => {
        const statusClass = getStatusClass(pedido.status);
        const produtosResumo = resumirProdutos(pedido.itens);
        
        let notas = [];
        if (pedido.nota) {
            notas = Array.isArray(pedido.nota) ? pedido.nota : [pedido.nota];
        }
        const temNotaFiscal = notas.length > 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${pedido.codigo_pedido || pedido.id}</td>
            <td>${pedido.clientes?.nome || pedido.cliente?.nome || '-'}</td>
            <td>${produtosResumo}</td>
            <td>${pedido.quantidade || calcularQuantidadeTotal(pedido.itens)}</td>
            <td>${formatarMoeda(pedido.valor_total || calcularValorTotal(pedido.itens))}</td>
            <td><span class="badge ${statusClass}">${pedido.status}</span></td>
            <td>
                ${temNotaFiscal ? 
                    `<span class="badge badge-success">${notas[0].numero || 'Nº ' + notas[0].id}</span>` : 
                    '<span class="text-muted">-</span>'
                }
            </td>
            <td>${formatarData(pedido.data_criacao)}</td>
            <td>${formatarData(pedido.updatedAt || pedido.data_atualizacao)}</td>
            <td class="table-actions">
                <div class="action-buttons">
                    <button class="btn btn-sm btn-info btn-view" data-id="${pedido.id}" title="Detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-warning btn-edit" data-id="${pedido.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${temNotaFiscal ? 
                        `<button class="btn btn-sm btn-secondary btn-print-nota" data-id="${pedido.id}" title="Imprimir Nota">
                            <i class="fas fa-print"></i>
                        </button>` : ''
                    }
                    <button class="btn btn-sm btn-danger btn-delete" data-id="${pedido.id}" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', function() {
            verDetalhesPedido(this.dataset.id);
        });
    });
    
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', function() {
            abrirEdicaoPedido(this.dataset.id);
        });
    });
    
    tbody.querySelectorAll('.btn-print-nota').forEach(btn => {
        btn.addEventListener('click', function() {
            visualizarNotaPdf(this.dataset.id);
        });
    });
    
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', function() {
            excluirPedido(this.dataset.id);
        });
    });

    renderizarPaginacaoPedidos();
}

function resumirProdutos(itens) {
    if (!itens || !Array.isArray(itens) || itens.length === 0) return '-';
    
    const nomes = itens.map(item => item.produtos?.nome || item.produto?.nome).filter(Boolean);
    if (nomes.length === 0) return '-';
    
    const principais = nomes.slice(0, 2);
    const restantes = nomes.length - 2;
    
    let html = principais.join(', ');
    if (restantes > 0) {
        html += ` <span class="badge badge-info">+${restantes}</span>`;
    }
    
    return html;
}

function calcularQuantidadeTotal(itens) {
    if (!itens || !Array.isArray(itens)) return 0;
    return itens.reduce((total, item) => total + (item.quantidade || 0), 0);
}

function calcularValorTotal(itens) {
    if (!itens || !Array.isArray(itens)) return 0;
    return itens.reduce((total, item) => total + (item.valor_total || 0), 0);
}

function renderizarPaginacaoPedidos() {
    const container = document.getElementById('pedidos-pagination-container');
    if (!container) return;
    
    container.innerHTML = '';

    const total = pedidosTotalPages;
    const current = pedidosCurrentPage;

    if (total <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = `btn btn-sm btn-light mr-1 ${current === 1 ? 'disabled' : ''}`;
    prevBtn.innerHTML = '«';
    prevBtn.disabled = current === 1;
    prevBtn.addEventListener('click', () => {
        if (current > 1) carregarPedidos(filtrosAtuais, current - 1);
    });
    container.appendChild(prevBtn);

    const maxShow = 7;
    let start = 1, end = total;
    if (total > maxShow) {
        const half = Math.floor(maxShow / 2);
        start = Math.max(1, current - half);
        end = Math.min(total, start + maxShow - 1);
        if (end - start < maxShow - 1) {
            start = Math.max(1, end - maxShow + 1);
        }
    }
    
    for (let p = start; p <= end; p++) {
        const btn = document.createElement('button');
        btn.className = `btn btn-sm mr-1 ${p === current ? 'btn-primary' : 'btn-outline-secondary'}`;
        btn.textContent = p;
        btn.addEventListener('click', () => carregarPedidos(filtrosAtuais, p));
        container.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = `btn btn-sm btn-light ${current === total ? 'disabled' : ''}`;
    nextBtn.innerHTML = '»';
    nextBtn.disabled = current === total;
    nextBtn.addEventListener('click', () => {
        if (current < total) carregarPedidos(filtrosAtuais, current + 1);
    });
    container.appendChild(nextBtn);
}

async function carregarContadoresTotais(filtros = {}) {
    try {
        const params = { ...filtros };
        
        if (params.termoBusca) {
            params.search = params.termoBusca;
            delete params.termoBusca;
        }
        
        Object.keys(params).forEach(key => {
            if (!params[key]) delete params[key];
        });

        const contadores = await apiGet('/pedidos/contadores', params);
        
        const totalPendentes = document.getElementById('total-pendentes');
        const totalProcessando = document.getElementById('total-processando');
        const totalEmRota = document.getElementById('total-em-rota');
        const totalEntregues = document.getElementById('total-entregues');
        
        if (totalPendentes) totalPendentes.textContent = contadores.PENDENTE || 0;
        if (totalProcessando) totalProcessando.textContent = contadores.PROCESSANDO || 0;
        if (totalEmRota) totalEmRota.textContent = contadores.EM_ROTA || 0;
        if (totalEntregues) totalEntregues.textContent = contadores.ENTREGUE || 0;
        
    } catch (error) {
        console.error('Erro ao carregar contadores totais:', error);
    }
}

function abrirModalNovoPedido() {
    if (produtos.length === 0) {
        mostrarErro('Carregue os produtos antes de criar um pedido');
        return;
    }
    
    const form = document.getElementById('form-novo-pedido');
    if (form) form.reset();
    
    const tbodyItens = document.getElementById('tabela-itens-novo');
    if (tbodyItens) tbodyItens.innerHTML = '';
    
    const totalPedido = document.getElementById('total-pedido-novo');
    if (totalPedido) totalPedido.textContent = 'R$ 0,00';
    
    // Resetar seção de nota fiscal
    const secaoNota = document.getElementById('novo-pedido-secao-nota');
    if (secaoNota) secaoNota.style.display = 'none';
    
    const gerarNotaCheckbox = document.getElementById('novo-pedido-gerar-nota');
    if (gerarNotaCheckbox) gerarNotaCheckbox.checked = false;
    
    // Limpar e resetar campos manuais
    limparCamposManuais('novo');
    
    adicionarItemNovoPedido();
    
    const modal = document.getElementById('modal-novo-pedido');
    if (modal) {
        $(modal).modal('show');
    }
}

function adicionarItemNovoPedido(item = null) {
    const tbody = document.getElementById('tabela-itens-novo');
    if (!tbody) return;
    
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    
    tr.innerHTML = `
        <td>
            <select class="form-control form-control-sm select-produto" required>
                <option value="">Selecione um produto</option>
                ${produtos.map(prod =>
                    `<option value="${prod.id}" data-preco="${prod.preco || 0}">
                        ${prod.nome} - ${formatarMoeda(prod.preco || 0)}
                    </option>`
                ).join('')}
            </select>
        </td>
        <td>
            <input type="number" class="form-control form-control-sm input-quantidade" 
                   min="1" value="${item ? item.quantidade : 1}" required>
        </td>
        <td>
            <input type="number" class="form-control form-control-sm input-valor-unitario" 
                   step="0.01" value="${item ? item.valor_unitario : ''}" required>
        </td>
        <td>
            <input type="text" class="form-control form-control-sm input-descricao" 
                   value="${item ? item.descricao : ''}" placeholder="Descrição do item">
        </td>
        <td>
            <input type="text" class="form-control form-control-sm input-observacao" 
                   value="${item ? item.observacao : ''}" placeholder="Observações">
        </td>
        <td class="subtotal">${item ? formatarMoeda(item.quantidade * item.valor_unitario) : 'R$ 0,00'}</td>
        <td>
            <button type="button" class="btn btn-remove-item" onclick="removerItem(this)">
                <i class="fas fa-times text-danger"></i>
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);
    
    const selectProduto = tr.querySelector('.select-produto');
    const inputQuantidade = tr.querySelector('.input-quantidade');
    const inputValorUnitario = tr.querySelector('.input-valor-unitario');
    
    if (item) {
        if (selectProduto) selectProduto.value = item.produto_id;
        if (inputValorUnitario && item.valor_unitario) {
            inputValorUnitario.value = item.valor_unitario;
        }
    }
    
    if (selectProduto) {
        selectProduto.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const preco = selectedOption ? parseFloat(selectedOption.dataset.preco) : 0;
            if (preco > 0 && inputValorUnitario) {
                inputValorUnitario.value = preco;
                calcularSubtotal(tr);
                calcularTotalPedido('novo');
            }
        });
    }
    
    if (inputQuantidade) {
        inputQuantidade.addEventListener('input', () => {
            calcularSubtotal(tr);
            calcularTotalPedido('novo');
        });
    }
    
    if (inputValorUnitario) {
        inputValorUnitario.addEventListener('input', () => {
            calcularSubtotal(tr);
            calcularTotalPedido('novo');
        });
    }
    
    if (item) {
        calcularSubtotal(tr);
    }
}

function removerItem(botao) {
    const tr = botao.closest('tr');
    if (!tr) return;
    
    tr.remove();
    
    const tbody = tr.closest('tbody');
    if (tbody) {
        const modalType = tbody.id.includes('novo') ? 'novo' : 'editar';
        calcularTotalPedido(modalType);
    }
}

function calcularSubtotal(linha) {
    if (!linha) return 0;
    
    const inputQuantidade = linha.querySelector('.input-quantidade');
    const inputValorUnitario = linha.querySelector('.input-valor-unitario');
    const subtotalElement = linha.querySelector('.subtotal');
    
    if (!inputQuantidade || !inputValorUnitario || !subtotalElement) return 0;
    
    const quantidade = parseFloat(inputQuantidade.value) || 0;
    const valorUnitario = parseFloat(inputValorUnitario.value) || 0;
    const subtotal = quantidade * valorUnitario;
    
    subtotalElement.textContent = formatarMoeda(subtotal);
    return subtotal;
}

function calcularTotalPedido(modalType) {
    const tbody = document.getElementById(`tabela-itens-${modalType}`);
    if (!tbody) return 0;
    
    const linhas = tbody.querySelectorAll('tr');
    
    let total = 0;
    linhas.forEach(linha => {
        total += calcularSubtotal(linha);
    });
    
    const totalElement = document.getElementById(`total-pedido-${modalType}`);
    if (totalElement) {
        totalElement.textContent = formatarMoeda(total);
    }
    return total;
}

function validarProdutosSelecionados(itensData) {
    const produtosInexistentes = [];
    
    for (const item of itensData) {
        const produtoExiste = produtos.some(prod => prod.id === item.produto_id);
        if (!produtoExiste) {
            produtosInexistentes.push(item.produto_id);
        }
    }
    
    return produtosInexistentes;
}

async function criarPedido() {
    const form = document.getElementById('form-novo-pedido');
    if (!form) return;
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Validar campos da nota fiscal
    const validacaoNota = validarCamposNota('novo');
    if (!validacaoNota.valido) {
        mostrarErro(validacaoNota.erros.join('\n'));
        return;
    }
    
    const itens = document.querySelectorAll('#tabela-itens-novo tr');
    if (itens.length === 0) {
        mostrarErro('Adicione pelo menos um item ao pedido');
        return;
    }
    
    // Montar payload de cliente e endereço
    let payloadClienteEndereco;
    try {
        payloadClienteEndereco = montarPayloadClienteEndereco('novo');
    } catch (error) {
        mostrarErro(error.message);
        return;
    }
    
    const itensData = [];
    const produtosInexistentes = [];
    
    for (const linha of itens) {
        const produtoSelect = linha.querySelector('.select-produto');
        const quantidadeInput = linha.querySelector('.input-quantidade');
        const valorUnitarioInput = linha.querySelector('.input-valor-unitario');
        const descricaoInput = linha.querySelector('.input-descricao');
        const observacaoInput = linha.querySelector('.input-observacao');
        
        if (!produtoSelect?.value || !quantidadeInput?.value || !valorUnitarioInput?.value) {
            mostrarErro('Preencha todos os campos obrigatórios dos itens');
            return;
        }
        
        const produtoId = Number(produtoSelect.value);
        const quantidade = parseInt(quantidadeInput.value);
        const valorUnitario = parseFloat(valorUnitarioInput.value);
        
        if (isNaN(produtoId) || produtoId <= 0) {
            mostrarErro('ID do produto inválido');
            return;
        }
        
        if (isNaN(quantidade) || quantidade <= 0) {
            mostrarErro('Quantidade deve ser um número maior que zero');
            return;
        }
        
        if (isNaN(valorUnitario) || valorUnitario < 0) {
            mostrarErro('Valor unitário deve ser um número válido');
            return;
        }
        
        // Validar se o produto existe localmente
        const produtoExiste = produtos.some(prod => prod.id === produtoId);
        if (!produtoExiste) {
            produtosInexistentes.push(produtoId);
            continue;
        }
        
        itensData.push({
            produto_id: produtoId,
            quantidade: quantidade,
            valor_unitario: valorUnitario,
            descricao: descricaoInput?.value || '',
            observacao: observacaoInput?.value || ''
        });
    }
    
    if (produtosInexistentes.length > 0) {
        mostrarErro(`Não foi possível criar o pedido. Produtos inexistentes: ${produtosInexistentes.join(', ')}. Verifique os produtos selecionados.`);
        return;
    }
    
    if (itensData.length === 0) {
        mostrarErro('Nenhum item válido para criar o pedido');
        return;
    }
    
    const payload = {
        ...payloadClienteEndereco,
        codigo_pedido: document.getElementById('novo-pedido-codigo')?.value,
        status: document.getElementById('novo-pedido-status')?.value,
        itens: itensData,
        gerarNota: document.getElementById('novo-pedido-gerar-nota')?.checked || false,
        autoReserve: document.getElementById('novo-pedido-auto-reserve')?.checked || false,
        autoConsumeStock: document.getElementById('novo-pedido-auto-consume')?.checked || false
    };
    
    // Adicionar dados da nota fiscal se necessário
    const dadosNota = obterDadosNota('novo');
    if (dadosNota) {
        payload.nota = dadosNota;
    }
    
    try {
        mostrarCarregamento(true);
        const resultado = await apiPost('/pedidos', payload);
        
        mostrarSucesso('Pedido criado com sucesso!');
        const modal = document.getElementById('modal-novo-pedido');
        if (modal) {
            $(modal).modal('hide');
        }
        
        await carregarPedidos(filtrosAtuais, 1);
        
    } catch (error) {
        console.error('Erro ao criar pedido:', error);
        mostrarErro('Erro ao criar pedido: ' + error.message);
    } finally {
        mostrarCarregamento(false);
    }
}

async function abrirEdicaoPedido(pedidoId) {
    try {
        mostrarCarregamento(true);
        const pedido = await apiGet(`/pedidos/${pedidoId}`);
        
        const pedidoIdInput = document.getElementById('editar-pedido-id');
        const clienteSelect = document.getElementById('editar-pedido-cliente');
        const codigoInput = document.getElementById('editar-pedido-codigo');
        const statusSelect = document.getElementById('editar-pedido-status');
        
        if (pedidoIdInput) pedidoIdInput.value = pedido.id;
        if (clienteSelect) clienteSelect.value = pedido.cliente_id;
        if (codigoInput) codigoInput.value = pedido.codigo_pedido;
        if (statusSelect) statusSelect.value = pedido.status;
        
        // Limpar e resetar campos manuais
        limparCamposManuais('editar');
        
        await carregarEnderecosCliente(pedido.cliente_id, 'editar-pedido-endereco');
        setTimeout(() => {
            const enderecoSelect = document.getElementById('editar-pedido-endereco');
            if (enderecoSelect) enderecoSelect.value = pedido.endereco_id;
        }, 100);
        
        const tbodyItens = document.getElementById('tabela-itens-editar');
        if (tbodyItens) {
            tbodyItens.innerHTML = '';
            if (pedido.itens && Array.isArray(pedido.itens)) {
                pedido.itens.forEach(item => {
                    adicionarItemEditarPedido(item);
                });
            }
        }
        
        // Preencher dados da nota fiscal se existir
        if (pedido.nota) {
            preencherCamposNota('editar', pedido.nota);
        } else {
            // Garantir que a seção esteja escondida se não houver nota
            const secaoNota = document.getElementById('editar-pedido-secao-nota');
            if (secaoNota) secaoNota.style.display = 'none';
            
            const gerarNotaCheckbox = document.getElementById('editar-pedido-gerar-nota');
            if (gerarNotaCheckbox) gerarNotaCheckbox.checked = false;
        }
        
        calcularTotalPedido('editar');
        const modal = document.getElementById('modal-editar-pedido');
        if (modal) {
            $(modal).modal('show');
        }
        
    } catch (error) {
        console.error('Erro ao carregar pedido para edição:', error);
        mostrarErro('Erro ao carregar pedido: ' + error.message);
    } finally {
        mostrarCarregamento(false);
    }
}

function adicionarItemEditarPedido(item = null) {
    const tbody = document.getElementById('tabela-itens-editar');
    if (!tbody) return;
    
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    
    tr.innerHTML = `
        <td>
            <select class="form-control form-control-sm select-produto" required>
                <option value="">Selecione um produto</option>
                ${produtos.map(prod =>
                    `<option value="${prod.id}" data-preco="${prod.preco || 0}">
                        ${prod.nome} - ${formatarMoeda(prod.preco || 0)}
                    </option>`
                ).join('')}
            </select>
        </td>
        <td>
            <input type="number" class="form-control form-control-sm input-quantidade" 
                   min="1" value="${item ? item.quantidade : 1}" required>
        </td>
        <td>
            <input type="number" class="form-control form-control-sm input-valor-unitario" 
                   step="0.01" value="${item ? item.valor_unitario : ''}" required>
        </td>
        <td>
            <input type="text" class="form-control form-control-sm input-descricao" 
                   value="${item ? item.descricao : ''}" placeholder="Descrição do item">
        </td>
        <td>
            <input type="text" class="form-control form-control-sm input-observacao" 
                   value="${item ? item.observacao : ''}" placeholder="Observações">
        </td>
        <td class="subtotal">${item ? formatarMoeda(item.quantidade * item.valor_unitario) : 'R$ 0,00'}</td>
        <td>
            <button type="button" class="btn btn-remove-item" onclick="removerItem(this)">
                <i class="fas fa-times text-danger"></i>
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);
    
    const selectProduto = tr.querySelector('.select-produto');
    const inputQuantidade = tr.querySelector('.input-quantidade');
    const inputValorUnitario = tr.querySelector('.input-valor-unitario');
    
    if (item) {
        if (selectProduto) selectProduto.value = item.produto_id;
        if (inputValorUnitario && item.valor_unitario) {
            inputValorUnitario.value = item.valor_unitario;
        }
    }
    
    if (selectProduto) {
        selectProduto.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const preco = selectedOption ? parseFloat(selectedOption.dataset.preco) : 0;
            if (preco > 0 && inputValorUnitario) {
                inputValorUnitario.value = preco;
                calcularSubtotal(tr);
                calcularTotalPedido('editar');
            }
        });
    }
    
    if (inputQuantidade) {
        inputQuantidade.addEventListener('input', () => {
            calcularSubtotal(tr);
            calcularTotalPedido('editar');
        });
    }
    
    if (inputValorUnitario) {
        inputValorUnitario.addEventListener('input', () => {
            calcularSubtotal(tr);
            calcularTotalPedido('editar');
        });
    }
    
    if (item) {
        calcularSubtotal(tr);
    }
}

async function salvarEdicaoPedido() {
    const pedidoId = document.getElementById('editar-pedido-id')?.value;
    if (!pedidoId) {
        mostrarErro('ID do pedido não encontrado');
        return;
    }
    
    const form = document.getElementById('form-editar-pedido');
    if (!form) return;
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Validar campos da nota fiscal
    const validacaoNota = validarCamposNota('editar');
    if (!validacaoNota.valido) {
        mostrarErro(validacaoNota.erros.join('\n'));
        return;
    }
    
    // Montar payload de cliente e endereço
    let payloadClienteEndereco;
    try {
        payloadClienteEndereco = montarPayloadClienteEndereco('editar');
    } catch (error) {
        mostrarErro(error.message);
        return;
    }
    
    const itens = document.querySelectorAll('#tabela-itens-editar tr');
    const itensData = [];
    const produtosInexistentes = [];
    
    for (const linha of itens) {
        const produtoSelect = linha.querySelector('.select-produto');
        const quantidadeInput = linha.querySelector('.input-quantidade');
        const valorUnitarioInput = linha.querySelector('.input-valor-unitario');
        const descricaoInput = linha.querySelector('.input-descricao');
        const observacaoInput = linha.querySelector('.input-observacao');
        
        if (!produtoSelect?.value || !quantidadeInput?.value || !valorUnitarioInput?.value) {
            mostrarErro('Preencha todos os campos obrigatórios dos itens');
            return;
        }
        
        const produtoId = Number(produtoSelect.value);
        const quantidade = parseInt(quantidadeInput.value);
        const valorUnitario = parseFloat(valorUnitarioInput.value);
        
        if (isNaN(produtoId) || produtoId <= 0) {
            mostrarErro('ID do produto inválido');
            return;
        }
        
        if (isNaN(quantidade) || quantidade <= 0) {
            mostrarErro('Quantidade deve ser um número maior que zero');
            return;
        }
        
        if (isNaN(valorUnitario) || valorUnitario < 0) {
            mostrarErro('Valor unitário deve ser um número válido');
            return;
        }
        
        const produtoExiste = produtos.some(prod => prod.id === produtoId);
        if (!produtoExiste) {
            produtosInexistentes.push(produtoId);
            continue;
        }
        
        itensData.push({
            produto_id: produtoId,
            quantidade: quantidade,
            valor_unitario: valorUnitario,
            descricao: descricaoInput?.value || '',
            observacao: observacaoInput?.value || ''
        });
    }
    
    if (produtosInexistentes.length > 0) {
        mostrarErro(`Não foi possível atualizar o pedido. Produtos inexistentes: ${produtosInexistentes.join(', ')}. Verifique os produtos selecionados.`);
        return;
    }
    
    if (itensData.length === 0) {
        mostrarErro('Adicione pelo menos um item válido ao pedido');
        return;
    }
    
    const payload = {
        ...payloadClienteEndereco,
        codigo_pedido: document.getElementById('editar-pedido-codigo')?.value,
        status: document.getElementById('editar-pedido-status')?.value,
        itens: itensData
    };
    
    // Adicionar dados da nota fiscal se necessário
    const dadosNota = obterDadosNota('editar');
    if (dadosNota) {
        payload.nota = dadosNota;
    }
    
    try {
        mostrarCarregamento(true);
        await apiPut(`/pedidos/${pedidoId}`, payload);
        
        mostrarSucesso('Pedido atualizado com sucesso!');
        const modal = document.getElementById('modal-editar-pedido');
        if (modal) {
            $(modal).modal('hide');
        }
        
        await carregarPedidos(filtrosAtuais, pedidosCurrentPage);
        
    } catch (error) {
        console.error('Erro ao atualizar pedido:', error);
        mostrarErro('Erro ao atualizar pedido: ' + error.message);
    } finally {
        mostrarCarregamento(false);
    }
}

async function verDetalhesPedido(pedidoId) {
    try {
        mostrarCarregamento(true);
        const pedido = await apiGet(`/pedidos/${pedidoId}`);
        pedidoDetalhado = pedido;
        
        const notas = await fetchNotaByPedido(pedidoId);
        
        const codigoInput = document.getElementById('detalhe-codigo');
        const clienteInput = document.getElementById('detalhe-cliente');
        const statusInput = document.getElementById('detalhe-status');
        const criacaoInput = document.getElementById('detalhe-criacao');
        const atualizacaoInput = document.getElementById('detalhe-atualizacao');
        
        if (codigoInput) codigoInput.value = pedido.codigo_pedido || pedido.id;
        if (clienteInput) clienteInput.value = pedido.clientes?.nome || pedido.cliente?.nome || '-';
        if (statusInput) statusInput.value = pedido.status;
        if (criacaoInput) criacaoInput.value = formatarData(pedido.data_criacao);
        if (atualizacaoInput) atualizacaoInput.value = formatarData(pedido.updatedAt || pedido.data_atualizacao);
        
        const enderecoInput = document.getElementById('detalhe-endereco');
        if (enderecoInput) {
            const endereco = pedido.enderecos || pedido.endereco;
            const enderecoTexto = endereco ? 
                `${endereco.rua}, ${endereco.numero} - ${endereco.bairro}, ${endereco.cidade} - ${endereco.estado}, ${endereco.cep}` : 
                'Endereço não informado';
            enderecoInput.value = enderecoTexto;
        }
        
        const qrCodeElement = document.getElementById('detalhe-qr-code');
        if (qrCodeElement) {
            qrCodeElement.textContent = pedido.etiqueta_qr || 'QR Code não gerado';
        }
        
        const tbodyItens = document.getElementById('detalhe-itens');
        if (tbodyItens) {
            tbodyItens.innerHTML = '';
            
            if (pedido.itens && Array.isArray(pedido.itens)) {
                pedido.itens.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.produtos?.nome || item.produto?.nome || '-'}</td>
                        <td>${item.produtos?.codigo || item.produto?.codigo || '-'}</td>
                        <td>${item.quantidade}</td>
                        <td>${formatarMoeda(item.valor_unitario)}</td>
                        <td>${formatarMoeda(item.valor_total || item.quantidade * item.valor_unitario)}</td>
                        <td>${item.observacao || '-'}</td>
                    `;
                    tbodyItens.appendChild(tr);
                });
            }
        }
        
        const containerNota = document.getElementById('detalhe-nota-fiscal');
        const btnVisualizarNota = document.getElementById('btn-visualizar-nota');
        
        if (containerNota) {
            if (notas && notas.length > 0) {
                let notasHtml = '';
                
                notas.forEach((nota, index) => {
                    const itensNota = nota.notaItens || nota.itens || [];
                    
                    notasHtml += `
                        <div class="nota-fiscal-item mb-4 p-3 border rounded">
                            <div class="row">
                                <div class="col-md-6">
                                    <p><strong>Número:</strong> ${nota.numero || '-'}</p>
                                    <p><strong>Série:</strong> ${nota.serie || '-'}</p>
                                    <p><strong>Data de Emissão:</strong> ${formatarData(nota.data_emissao)}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Chave NFe:</strong> ${nota.chave_nfe || '-'}</p>
                                    <p><strong>Tipo:</strong> ${nota.tipo || '-'}</p>
                                    <button class="btn btn-sm btn-primary btn-visualizar-nota-individual" 
                                            data-pedido-id="${pedidoId}" data-nota-index="${index}">
                                        Visualizar Esta Nota
                                    </button>
                                </div>
                            </div>
                            ${itensNota.length > 0 ? `
                                <h6>Itens da Nota Fiscal:</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Produto</th>
                                                <th>Quantidade</th>
                                                <th>Valor Unitário</th>
                                                <th>Valor Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${itensNota.map(item => `
                                                <tr>
                                                    <td>${item.produtos?.nome || item.produto?.nome || item.descricao || '-'}</td>
                                                    <td>${item.quantidade}</td>
                                                    <td>${formatarMoeda(item.valor_unitario)}</td>
                                                    <td>${formatarMoeda(item.valor_total)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : ''}
                        </div>
                    `;
                });
                
                containerNota.innerHTML = notasHtml;
                
                containerNota.querySelectorAll('.btn-visualizar-nota-individual').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const pedidoId = this.dataset.pedidoId;
                        const notaIndex = this.dataset.notaIndex;
                        visualizarNotaPdf(pedidoId, notaIndex);
                    });
                });
                
                if (btnVisualizarNota) {
                    btnVisualizarNota.style.display = 'inline-block';
                    btnVisualizarNota.onclick = () => visualizarNotaPdf(pedidoId);
                }
            } else {
                containerNota.innerHTML = '<p class="text-muted">Nenhuma nota fiscal associada a este pedido</p>';
                if (btnVisualizarNota) {
                    btnVisualizarNota.style.display = 'none';
                }
            }
        }
        
        const timeline = document.getElementById('timeline-rastreamento');
        if (timeline) {
            timeline.innerHTML = '';
            
            if (pedido.rastreamentos && Array.isArray(pedido.rastreamentos)) {
                pedido.rastreamentos.forEach(rastro => {
                    const div = document.createElement('div');
                    div.className = `timeline-item ${getStatusTimelineClass(rastro.status_atual)}`;
                    div.innerHTML = `
                        <strong>${rastro.status_atual}</strong><br>
                        <small>${formatarData(rastro.data_status)}</small><br>
                        <small>${rastro.localizacao || ''}</small>
                        ${rastro.observacao ? `<br><small>${rastro.observacao}</small>` : ''}
                    `;
                    timeline.appendChild(div);
                });
            } else {
                timeline.innerHTML = '<div class="timeline-item">Nenhum histórico de rastreamento encontrado</div>';
            }
        }
        
        const modal = document.getElementById('modal-detalhes');
        if (modal) {
            $(modal).modal('show');
        }
        
    } catch (error) {
        console.error('Erro ao carregar detalhes do pedido:', error);
        mostrarErro('Erro ao carregar detalhes do pedido: ' + error.message);
    } finally {
        mostrarCarregamento(false);
    }
}



async function visualizarNotaPdf(pedidoId, notaIndex = 0) {
    try {
        const pedido = pedidosData.find(p => p.id == pedidoId) || pedidoDetalhado;
        if (!pedido) {
            mostrarErro('Pedido não encontrado');
            return;
        }
        
        const notas = await fetchNotaByPedido(pedidoId);
        if (!notas || notas.length === 0) {
            mostrarErro('Nenhuma nota fiscal encontrada para este pedido');
            return;
        }
        
        const nota = notas[notaIndex];
        if (!nota) {
            mostrarErro('Nota fiscal não encontrada');
            return;
        }
        
        const itensNota = nota.notaItens || nota.itens || [];
        
        const dadosNota = {
            tipo: 'POPULA_NFE',
            nota: {
                numero: nota.numero,
                serie: nota.serie,
                chave_nfe: nota.chave_nfe,
                data_emissao: nota.data_emissao,
                destinatario: {
                    nome: pedido.clientes?.nome || pedido.cliente?.nome,
                    cpf_cnpj: pedido.clientes?.cpf || pedido.cliente?.cpf,
                    endereco: pedido.enderecos ? 
                        `${pedido.enderecos.rua}, ${pedido.enderecos.numero} - ${pedido.enderecos.bairro}` : '',
                    cep: pedido.enderecos?.cep,
                    cidade: pedido.enderecos?.cidade,
                    uf: pedido.enderecos?.estado
                },
                itens: itensNota.map(item => ({
                    codigo: item.produtos?.codigo || item.produto?.codigo,
                    descricao: item.descricao || item.produtos?.nome || item.produto?.nome,
                    unidade: 'UN',
                    quantidade: item.quantidade,
                    valor_unitario: item.valor_unitario,
                    valor_total: item.valor_total
                })),
                impostos: {
                    base_icms: nota.base_calculo_icms,
                    valor_icms: nota.valor_icms,
                    valor_total_produtos: nota.valor_total_produtos,
                    frete: nota.valor_frete,
                    seguro: nota.valor_seguro,
                    outras_despesas: nota.outras_despesas,
                    valor_total_nota: nota.valor_total
                }
            },
            imprimir: true
        };
        
        const baseUrl = API_BASE_URL.replace(/\/$/, '');
        const notaUrl = `${baseUrl}/nf-e.html`;
        const targetOrigin = new URL(baseUrl).origin;
        
        const janela = window.open(notaUrl, '_blank');
        
        if (!janela) {
            mostrarErro('Não foi possível abrir a janela da nota fiscal. Verifique se os pop-ups estão bloqueados.');
            return;
        }
        
        let tentativas = 0;
        const maxTentativas = 5;
        
        const tentarEnviarDados = () => {
            try {
                janela.postMessage(dadosNota, targetOrigin);
                console.log('Dados da nota fiscal enviados com sucesso');
            } catch (e) {
                tentativas++;
                if (tentativas < maxTentativas) {
                    setTimeout(tentarEnviarDados, 300);
                } else {
                    console.error('Falha ao enviar dados para a nota fiscal após', maxTentativas, 'tentativas');
                    mostrarErro('Erro ao carregar dados da nota fiscal');
                }
            }
        };
        
        setTimeout(tentarEnviarDados, 500);
        
    } catch (error) {
        console.error('Erro ao visualizar nota fiscal:', error);
        mostrarErro('Erro ao visualizar nota fiscal: ' + error.message);
    }
}

async function excluirPedido(pedidoId) {
    if (!confirm('Tem certeza que deseja excluir este pedido?')) {
        return;
    }
    
    try {
        mostrarCarregamento(true);
        await apiDelete(`/pedidos/${pedidoId}`);
        
        mostrarSucesso('Pedido excluído com sucesso!');
        await carregarPedidos(filtrosAtuais, pedidosCurrentPage);
        
    } catch (error) {
        console.error('Erro ao excluir pedido:', error);
        mostrarErro('Erro ao excluir pedido: ' + error.message);
    } finally {
        mostrarCarregamento(false);
    }
}

function toggleSecaoNotaFiscal(modalType) {
    const checkbox = document.getElementById(`${modalType}-pedido-gerar-nota`);
    const secaoNota = document.getElementById(`${modalType}-pedido-secao-nota`);
    
    if (checkbox && secaoNota) {
        secaoNota.style.display = checkbox.checked ? 'block' : 'none';
        
        // Se estiver desmarcado, limpar os campos (opcional)
        if (!checkbox.checked) {
            limparCamposNota(modalType);
        }
    }
}

function montarPayloadClienteEndereco(modalType) {
    const payload = {};
    
    // Verificar se está usando cliente manual ou select
    const clienteSelect = document.getElementById(`${modalType}-pedido-cliente`);
    const clienteManualDiv = document.getElementById(`${modalType}-pedido-cliente-manual`);
    
    if (clienteManualDiv.style.display !== 'none') {
        // Modo manual - coletar dados dos inputs
        const clienteNome = document.getElementById(`${modalType}-pedido-cliente-nome`).value;
        const clienteCpf = document.getElementById(`${modalType}-pedido-cliente-cpf`).value;
        const clienteEmail = document.getElementById(`${modalType}-pedido-cliente-email`).value;
        const clienteTelefone = document.getElementById(`${modalType}-pedido-cliente-telefone`).value;
        
        if (!clienteNome) {
            throw new Error('Nome do cliente é obrigatório quando preenchido manualmente');
        }
        
        payload.cliente = {
            nome: clienteNome,
            cpf: clienteCpf || null,
            email: clienteEmail || null,
            telefone: clienteTelefone || null
        };
    } else {
        // Modo select - usar ID do cliente
        const clienteId = clienteSelect.value;
        if (!clienteId) {
            throw new Error('Selecione um cliente ou preencha os dados manualmente');
        }
        payload.cliente_id = Number(clienteId);
    }
    
    // Verificar se está usando endereço manual ou select
    const enderecoSelect = document.getElementById(`${modalType}-pedido-endereco`);
    const enderecoManualDiv = document.getElementById(`${modalType}-pedido-endereco-manual`);
    
    if (enderecoManualDiv.style.display !== 'none') {
        // Modo manual - coletar dados dos inputs
        const enderecoRua = document.getElementById(`${modalType}-pedido-endereco-rua`).value;
        const enderecoNumero = document.getElementById(`${modalType}-pedido-endereco-numero`).value;
        const enderecoComplemento = document.getElementById(`${modalType}-pedido-endereco-complemento`).value;
        const enderecoBairro = document.getElementById(`${modalType}-pedido-endereco-bairro`).value;
        const enderecoCidade = document.getElementById(`${modalType}-pedido-endereco-cidade`).value;
        const enderecoEstado = document.getElementById(`${modalType}-pedido-endereco-estado`).value;
        const enderecoCep = document.getElementById(`${modalType}-pedido-endereco-cep`).value;
        
        // Validar campos obrigatórios
        if (!enderecoRua || !enderecoNumero || !enderecoBairro || !enderecoCidade || !enderecoEstado || !enderecoCep) {
            throw new Error('Todos os campos obrigatórios do endereço devem ser preenchidos');
        }
        
        payload.endereco = {
            rua: enderecoRua,
            numero: enderecoNumero,
            complemento: enderecoComplemento || null,
            bairro: enderecoBairro,
            cidade: enderecoCidade,
            estado: enderecoEstado,
            cep: enderecoCep
        };
    } else {
        // Modo select - usar ID do endereço
        const enderecoId = enderecoSelect.value;
        if (!enderecoId) {
            throw new Error('Selecione um endereço ou preencha os dados manualmente');
        }
        payload.endereco_id = Number(enderecoId);
    }
    
    return payload;
}

function limparCamposManuais(modalType) {
    // Limpar campos do cliente - apenas se existirem
    const camposCliente = [
        `${modalType}-pedido-cliente-nome`,
        `${modalType}-pedido-cliente-cpf`, 
        `${modalType}-pedido-cliente-email`,
        `${modalType}-pedido-cliente-telefone`
    ];
    
    camposCliente.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    
    // Limpar campos do endereço - apenas se existirem
    const camposEndereco = [
        `${modalType}-pedido-endereco-rua`,
        `${modalType}-pedido-endereco-numero`,
        `${modalType}-pedido-endereco-complemento`,
        `${modalType}-pedido-endereco-bairro`,
        `${modalType}-pedido-endereco-cidade`,
        `${modalType}-pedido-endereco-estado`,
        `${modalType}-pedido-endereco-cep`
    ];
    
    camposEndereco.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    
    // Garantir que os selects estejam visíveis - apenas se existirem
    const selectCliente = document.getElementById(`${modalType}-pedido-cliente`);
    const selectEndereco = document.getElementById(`${modalType}-pedido-endereco`);
    const manualCliente = document.getElementById(`${modalType}-pedido-cliente-manual`);
    const manualEndereco = document.getElementById(`${modalType}-pedido-endereco-manual`);
    
    if (selectCliente) {
        selectCliente.style.display = 'block';
        selectCliente.setAttribute('required', 'required');
    }
    
    if (selectEndereco) {
        selectEndereco.style.display = 'block';
        selectEndereco.setAttribute('required', 'required');
    }
    
    if (manualCliente) manualCliente.style.display = 'none';
    if (manualEndereco) manualEndereco.style.display = 'none';
    
    // Remover required dos campos manuais - apenas se existirem
    const requiredFields = ['rua', 'numero', 'bairro', 'cidade', 'estado', 'cep'];
    requiredFields.forEach(field => {
        const element = document.getElementById(`${modalType}-pedido-endereco-${field}`);
        if (element) element.removeAttribute('required');
    });
    
    const nomeCliente = document.getElementById(`${modalType}-pedido-cliente-nome`);
    if (nomeCliente) nomeCliente.removeAttribute('required');
}

function toggleClienteManual(modalType) {
    const select = document.getElementById(`${modalType}-pedido-cliente`);
    const manualDiv = document.getElementById(`${modalType}-pedido-cliente-manual`);
    
    if (manualDiv.style.display === 'none') {
        // Mostrar campos manuais
        select.style.display = 'none';
        manualDiv.style.display = 'block';
        select.removeAttribute('required');
        // Adicionar required no nome do cliente
        document.getElementById(`${modalType}-pedido-cliente-nome`).setAttribute('required', 'required');
    } else {
        // Mostrar select
        select.style.display = 'block';
        manualDiv.style.display = 'none';
        select.setAttribute('required', 'required');
        // Remover required dos campos manuais
        document.getElementById(`${modalType}-pedido-cliente-nome`).removeAttribute('required');
    }
}

function toggleEnderecoManual(modalType) {
    const select = document.getElementById(`${modalType}-pedido-endereco`);
    const manualDiv = document.getElementById(`${modalType}-pedido-endereco-manual`);
    
    if (manualDiv.style.display === 'none') {
        // Mostrar campos manuais
        select.style.display = 'none';
        manualDiv.style.display = 'block';
        select.removeAttribute('required');
        // Adicionar required nos campos obrigatórios do endereço
        const requiredFields = ['rua', 'numero', 'bairro', 'cidade', 'estado', 'cep'];
        requiredFields.forEach(field => {
            document.getElementById(`${modalType}-pedido-endereco-${field}`).setAttribute('required', 'required');
        });
    } else {
        // Mostrar select
        select.style.display = 'block';
        manualDiv.style.display = 'none';
        select.setAttribute('required', 'required');
        // Remover required dos campos manuais
        const requiredFields = ['rua', 'numero', 'bairro', 'cidade', 'estado', 'cep'];
        requiredFields.forEach(field => {
            document.getElementById(`${modalType}-pedido-endereco-${field}`).removeAttribute('required');
        });
    }
}

function limparCamposNota(modalType) {
    const campos = [
        'numero', 'serie', 'chave', 'data-emissao', 'valor-total', 'manifesto-id', 'tipo'
    ];
    
    campos.forEach(campo => {
        const element = document.getElementById(`${modalType}-pedido-nota-${campo}`);
        if (element) {
            element.value = '';
        }
    });
    
    // Resetar tipo para padrão
    const tipoSelect = document.getElementById(`${modalType}-pedido-nota-tipo`);
    if (tipoSelect) {
        tipoSelect.value = 'NF-e';
    }
}

function validarCamposNota(modalType) {
    const gerarNota = document.getElementById(`${modalType}-pedido-gerar-nota`)?.checked;
    
    if (!gerarNota) {
        return { valido: true }; // Não precisa validar se não está gerando nota
    }
    
    const numero = document.getElementById(`${modalType}-pedido-nota-numero`)?.value;
    const dataEmissao = document.getElementById(`${modalType}-pedido-nota-data-emissao`)?.value;
    const valorTotal = document.getElementById(`${modalType}-pedido-nota-valor-total`)?.value;
    
    const erros = [];
    
    // Validações básicas
    if (!numero) {
        erros.push('Número da nota é obrigatório quando "Gerar Nota Fiscal" está marcado.');
    }
    
    if (!dataEmissao) {
        erros.push('Data de emissão é obrigatória quando "Gerar Nota Fiscal" está marcado.');
    } else {
        const data = new Date(dataEmissao);
        if (isNaN(data.getTime())) {
            erros.push('Data de emissão deve ser uma data válida.');
        }
    }
    
    if (valorTotal) {
        const valor = parseFloat(valorTotal);
        if (isNaN(valor) || valor < 0) {
            erros.push('Valor total deve ser um número maior ou igual a zero.');
        }
    }
    
    return {
        valido: erros.length === 0,
        erros: erros
    };
}

function obterDadosNota(modalType) {
    const gerarNota = document.getElementById(`${modalType}-pedido-gerar-nota`)?.checked;
    
    if (!gerarNota) {
        return null;
    }
    
    const numero = document.getElementById(`${modalType}-pedido-nota-numero`)?.value;
    const serie = document.getElementById(`${modalType}-pedido-nota-serie`)?.value;
    const chave = document.getElementById(`${modalType}-pedido-nota-chave`)?.value;
    const dataEmissao = document.getElementById(`${modalType}-pedido-nota-data-emissao`)?.value;
    const valorTotal = document.getElementById(`${modalType}-pedido-nota-valor-total`)?.value;
    const manifestoId = document.getElementById(`${modalType}-pedido-nota-manifesto-id`)?.value;
    const tipo = document.getElementById(`${modalType}-pedido-nota-tipo`)?.value;
    
    // Verificar se há pelo menos um campo preenchido
    if (!numero && !serie && !chave && !dataEmissao && !valorTotal && !manifestoId) {
        return null;
    }
    
    const dadosNota = {
        numero: numero || null,
        serie: serie || null,
        chave_nfe: chave || null,
        data_emissao: dataEmissao ? new Date(dataEmissao).toISOString() : null,
        valor_total: valorTotal ? Number(parseFloat(valorTotal).toFixed(2)) : null,
        manifesto_id: manifestoId ? Number(manifestoId) : null,
        tipo: tipo || 'NF-e'
    };
    
    // Remover campos null/undefined
    Object.keys(dadosNota).forEach(key => {
        if (dadosNota[key] === null || dadosNota[key] === undefined) {
            delete dadosNota[key];
        }
    });
    
    return Object.keys(dadosNota).length > 0 ? dadosNota : null;
}

function preencherCamposNota(modalType, nota) {
    if (!nota) return;
    
    // Mostrar a seção de nota
    const secaoNota = document.getElementById(`${modalType}-pedido-secao-nota`);
    const checkboxGerarNota = document.getElementById(`${modalType}-pedido-gerar-nota`);
    
    if (secaoNota && checkboxGerarNota) {
        secaoNota.style.display = 'block';
        checkboxGerarNota.checked = true;
    }
    
    // Preencher campos individuais
    const campos = {
        'numero': nota.numero,
        'serie': nota.serie,
        'chave': nota.chave_nfe,
        'valor-total': nota.valor_total,
        'manifesto-id': nota.manifesto_id,
        'tipo': nota.tipo || 'NF-e'
    };
    
    Object.entries(campos).forEach(([campo, valor]) => {
        const element = document.getElementById(`${modalType}-pedido-nota-${campo}`);
        if (element && valor) {
            element.value = valor;
        }
    });
    
    // Tratar data de emissão separadamente (converter ISO para datetime-local)
    if (nota.data_emissao) {
        const dataEmissaoElement = document.getElementById(`${modalType}-pedido-nota-data-emissao`);
        if (dataEmissaoElement) {
            const data = new Date(nota.data_emissao);
            dataEmissaoElement.value = data.toISOString().slice(0, 16);
        }
    }
}

function filtrarPorStatus(status) {
    const filtroStatus = document.getElementById('filtro-status');
    if (filtroStatus) {
        filtroStatus.value = status;
        aplicarFiltros();
    }
}

function aplicarFiltros() {
    const filtros = {
        status: document.getElementById('filtro-status')?.value || '',
        cliente_id: document.getElementById('filtro-cliente')?.value || '',
        data_inicio: document.getElementById('filtro-data-inicio')?.value || '',
        data_fim: document.getElementById('filtro-data-fim')?.value || '',
        termoBusca: document.getElementById('input-busca')?.value.trim() || ''
    };
    
    Object.keys(filtros).forEach(key => {
        if (!filtros[key]) delete filtros[key];
    });
    
    carregarPedidos(filtros, 1);
}

function buscarPedidos() {
    aplicarFiltros();
}

function formatarMoeda(valor) {
    if (valor == null || isNaN(valor)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function formatarData(dataString) {
    if (!dataString) return '-';
    try {
        const data = new Date(dataString);
        return data.toLocaleString('pt-BR');
    } catch (e) {
        return dataString;
    }
}

function getStatusClass(status) {
    const classes = {
        'PENDENTE': 'badge-pendente',
        'PROCESSANDO': 'badge-processando',
        'EM_ROTA': 'badge-em-rota',
        'ENTREGUE': 'badge-entregue',
        'CANCELADO': 'badge-cancelado'
    };
    return classes[status] || 'badge-secondary';
}

function getStatusTimelineClass(status) {
    const classes = {
        'ENTREGUE': 'entregue',
        'CANCELADO': 'cancelado',
        'EM_ROTA': 'rota'
    };
    return classes[status] || '';
}

function mostrarCarregamento(mostrar) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = mostrar ? 'block' : 'none';
    }
}

function mostrarSucesso(mensagem) {
    alert('Sucesso: ' + mensagem);
}

function mostrarErro(mensagem) {
    alert('Erro: ' + mensagem);
}

window.filtrarPorStatus = filtrarPorStatus;
window.buscarPedidos = buscarPedidos;
window.aplicarFiltros = aplicarFiltros;
window.abrirModalNovoPedido = abrirModalNovoPedido;
window.criarPedido = criarPedido;
window.adicionarItemNovoPedido = adicionarItemNovoPedido;
window.adicionarItemEditarPedido = adicionarItemEditarPedido;
window.removerItem = removerItem;
window.verDetalhesPedido = verDetalhesPedido;
window.abrirEdicaoPedido = abrirEdicaoPedido;
window.salvarEdicaoPedido = salvarEdicaoPedido;
window.visualizarNotaPdf = visualizarNotaPdf;
window.toggleSecaoNotaFiscal = toggleSecaoNotaFiscal;
window.validarCamposNota = validarCamposNota;
window.obterDadosNota = obterDadosNota;
window.preencherCamposNota = preencherCamposNota;