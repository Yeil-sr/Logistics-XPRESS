const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8080'
    : 'https://logistics-xpress.vercel.app/';
const PAGE_SIZE = 10;
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
let conferenciasData = [];
let recebimentosData = [];
let operadoresSet = new Set();
let hubsData = [];

let scannerAtivo = false;
let pedidosValidados = new Set();

let conferenciasCurrentPage = 1;
let conferenciasTotalPages = 1;
let recebimentosCurrentPage = 1;
let recebimentosTotalPages = 1;

let modalPedidosConfData = [];
let modalPedidosConfPage = 1;
let modalPedidosConfTotalPages = 1;
let modalPedidosRecData = [];
let modalPedidosRecPage = 1;
let modalPedidosRecTotalPages = 1;

let currentConferenciaId = null;
let currentTotalEsperado = 0;
let currentTotalConferido = 0;

let editandoConferenciaId = null;
let editandoRecebimentoId = null;

let filtrosAtuaisConferencias = {};
let modoBuscaConferencias = false;
let termoBuscaConferencias = '';

let recebimentoState = {
    dadosGerais: {
        numero_recebimento: '',
        operador_id: '',
        usuario_id: '',
        tipo_tarefa: 'INBOUND',
        origem_hub_nome: '',
        destino_hub_nome: '',
        createMissingPedidos: true
    },
    transporte: {
        transportador_nome: '',
        cnpj_transportador: '',
        endereco_transportador: '',
        placa_veiculo: '',
        uf_veiculo: '',
        frete_por_conta: 'emitente',
        quantidade_volume: 0,
        especie_volumes: '',
        marca_volumes: '',
        numero_volumes: '',
        peso_bruto: 0,
        peso_liquido: 0,
        informacoes_transporte: ''
    },
    manifestos: [],
    pedidos: []
};

let pedidoEditando = null;
let manifestoEditando = null;
let notaEditando = null;
let itemNotaEditando = null;

// ========== FUNÇÕES UTILITÁRIAS DE NORMALIZAÇÃO DE MANIFESTOS ==========

/**
 * Retorna a fonte de verdade dos manifestos (array)
 * @param {Object} recebimentoState - Estado do recebimento
 * @returns {Array} Array de manifestos
 */
function _getManifestosFonte(recebimentoState) {
    return recebimentoState.manifestos || [];
}

/**
 * Normaliza os manifestos para o formato esperado pelo backend
 * @param {Object} recebimentoState - Estado do recebimento
 * @returns {Array} Array de manifestos normalizados
 */
function normalizarManifestosParaPayload(recebimentoState) {
    const manifestos = _getManifestosFonte(recebimentoState);
    const manifestosNormalizados = [];

    console.debug('[Normalização] Manifestos para normalizar:', manifestos);

    manifestos.forEach(manifesto => {
        // Normalizar notas do manifesto
        const notasNormalizadas = [];

        if (manifesto.notas && Array.isArray(manifesto.notas)) {
            manifesto.notas.forEach(nota => {
                // Normalizar itens da nota
                const itensNormalizados = [];

                if (nota.itens && Array.isArray(nota.itens)) {
                    nota.itens.forEach(item => {
                        // Garantir que os campos numéricos são números
                        const itemNormalizado = {
                            produto: {
                                nome: String(item.produto?.nome || ''),
                                descricao: item.produto?.descricao || null,
                                s_n: item.produto?.s_n || null,
                                p_n: item.produto?.p_n || null,
                                preco: parseFloat(item.produto?.preco) || 0,
                                peso_kg: parseFloat(item.produto?.peso_kg) || 0
                            },
                            quantidade: parseInt(item.quantidade) || 1,
                            valor_unitario: parseFloat(item.valor_unitario) || 0,
                            descricao: item.descricao || null
                        };

                        // Só adiciona se houver nome do produto
                        if (itemNormalizado.produto.nome) {
                            itensNormalizados.push(itemNormalizado);
                        }
                    });
                }

                // Só adiciona nota se tiver itens
                if (itensNormalizados.length > 0) {
                    const notaNormalizada = {
                        numero: String(nota.numero || ''),
                        serie: String(nota.serie || '1'),
                        data_emissao: nota.data_emissao ? new Date(nota.data_emissao).toISOString() : new Date().toISOString(),
                        itens: itensNormalizados
                    };
                    notasNormalizadas.push(notaNormalizada);
                }
            });
        } else {
            // Se não houver notas, adiciona uma nota vazia
            const notaNormalizada = {
                numero: `NF-MAN-${Date.now()}`,
                serie: '1',
                data_emissao: new Date().toISOString(),
                itens: []
            };
            notasNormalizadas.push(notaNormalizada);
        }

        // Só adiciona manifesto se tiver numero_manifesto
        if (manifesto.numero_manifesto) {
            const manifestoNormalizado = {
                numero_manifesto: String(manifesto.numero_manifesto || ''),
                serie: String(manifesto.serie || '1'),
                data_emissao: manifesto.data_emissao ? new Date(manifesto.data_emissao).toISOString() : new Date().toISOString(),
                observacoes: manifesto.observacoes || null,
                origem_hub_id: manifesto.origem_hub_id || null,
                destino_hub_id: manifesto.destino_hub_id || null,
                notas: notasNormalizadas
            };

            manifestosNormalizados.push(manifestoNormalizado);
        }
    });

    console.debug('[Normalização] Manifestos normalizados:', manifestosNormalizados);
    return manifestosNormalizados;
}

/**
 * Verifica se os manifestos no payload são válidos
 * @param {Object} payload - Payload completo do recebimento
 * @returns {boolean} True se houver pelo menos um manifesto válido
 */
function verificarPayloadManifestos(payload) {
    console.debug('[Verificação] Manifestos no payload:', payload.manifestos);
    console.debug('[Verificação] ManifestosCriados no payload:', payload.manifestosCriados);

    // Verifica se há pelo menos um manifesto com numero_manifesto
    const manifestos = payload.manifestos || [];
    let valido = false;

    manifestos.forEach(manifesto => {
        if (manifesto.numero_manifesto) {
            valido = true;
        }
    });

    if (!valido && manifestos.length > 0) {
        console.warn('[Verificação] Existem manifestos, mas nenhum com numero_manifesto.');
    }

    return valido;
}

function safeTrim(value) {
    return value ? String(value).trim() : '';
}

function getSafeValue(selector) {
    const element = document.querySelector(selector);
    return element ? safeTrim(element.value) : '';
}

function safeQuerySelector(selector) {
    const element = document.querySelector(selector);
    if (!element) {
        console.warn(`Elemento não encontrado: ${selector}`);
    }
    return element;
}

function escapeHtml(text) {
    if (text == null) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function (m) { return map[m]; });
}

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

function formatarDataSimples(dataString) {
    if (!dataString) return '-';
    const d = new Date(dataString);
    if (isNaN(d)) return dataString;
    return d.toLocaleDateString('pt-BR');
}

function formatarMoeda(valor) {
    if (valor == null || isNaN(valor)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function mostrarCarregamento(mostrar) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = mostrar ? 'block' : 'none';
    }
}

function mostrarFeedback(mensagem, tipo) {
    const feedback = document.getElementById('real-time-feedback');
    if (!feedback) {
        const tempFeedback = document.createElement('div');
        tempFeedback.className = `alert alert-${tipo === 'success' ? 'success' : 'danger'} alert-dismissible fade show`;
        tempFeedback.innerHTML = `
            ${mensagem}
            <button type="button" class="close" data-dismiss="alert">&times;</button>
        `;
        document.body.appendChild(tempFeedback);
        setTimeout(() => tempFeedback.remove(), 3000);
        return;
    }

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
        document.getElementById('filtro-operador-rec')
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

// ---------- Funções para Carregar Hubs ----------
async function carregarHubs() {
    try {
        const hubs = await apiRequest('/hubs', 'GET');
        hubsData = Array.isArray(hubs) ? hubs : [];
    } catch (error) {
        console.error('Erro ao carregar hubs:', error);
        mostrarFeedback('Erro ao carregar lista de hubs', 'error');
    }
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

// ---------- Funções de Autocomplete para Hubs ----------
async function buscarHubsPorNome(nome) {
    try {
        const hubs = await apiRequest('/hubs/search', 'GET', null, { nome });
        return hubs;
    } catch (error) {
        console.error('Erro ao buscar hubs:', error);
        return [];
    }
}

function inicializarAutocompleteHub(inputId, sugestoesId) {
    const input = document.getElementById(inputId);
    const sugestoes = document.getElementById(sugestoesId);

    if (!input || !sugestoes) return;

    let timeoutId;

    input.addEventListener('input', function () {
        clearTimeout(timeoutId);
        const termo = safeTrim(this.value);

        if (termo.length < 2) {
            sugestoes.innerHTML = '';
            sugestoes.style.display = 'none';
            return;
        }

        timeoutId = setTimeout(async () => {
            const hubs = await buscarHubsPorNome(termo);
            exibirSugestoes(hubs, sugestoes, input);
        }, 300);
    });

    document.addEventListener('click', function (e) {
        if (!sugestoes.contains(e.target) && e.target !== input) {
            sugestoes.style.display = 'none';
        }
    });
}

function exibirSugestoes(hubs, sugestoesElement, inputElement) {
    sugestoesElement.innerHTML = '';

    if (hubs.length === 0) {
        sugestoesElement.style.display = 'none';
        return;
    }

    hubs.forEach(hub => {
        const div = document.createElement('div');
        div.className = 'sugestao-item';
        div.textContent = `${hub.nome} - ${hub.codigo_hub || ''}`;
        div.addEventListener('click', function () {
            inputElement.value = hub.nome;
            inputElement.setAttribute('data-hub-id', hub.id);
            sugestoesElement.style.display = 'none';
        });
        sugestoesElement.appendChild(div);
    });

    sugestoesElement.style.display = 'block';
}

// ========== FUNÇÕES PARA MANIFESTOS ==========
function adicionarManifesto() {
    const origemHubNome = safeTrim(document.getElementById('origem-hub-nome')?.value);
    const destinoHubNome = safeTrim(document.getElementById('destino-hub-nome')?.value);

    // Obter IDs dos hubs se disponíveis
    const origemInput = document.getElementById('origem-hub-nome');
    const destinoInput = document.getElementById('destino-hub-nome');

    const novoManifesto = {
        numero_manifesto: '',
        serie: '1',
        data_emissao: new Date().toISOString(),
        observacoes: '',
        origem_hub_nome: origemHubNome,
        destino_hub_nome: destinoHubNome,
        origem_hub_id: origemInput?.getAttribute('data-hub-id') || null,
        destino_hub_id: destinoInput?.getAttribute('data-hub-id') || null,
        notas: []
    };

    recebimentoState.manifestos.push(novoManifesto);
    atualizarListaManifestos();
    mostrarFeedback('Novo manifesto adicionado', 'success');
}

function atualizarListaManifestos() {
    const lista = document.getElementById('lista-manifestos');
    if (!lista) return;

    lista.innerHTML = '';

    if (recebimentoState.manifestos.length === 0) {
        lista.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-file-alt fa-2x mb-2"></i><p>Nenhum manifesto adicionado</p></div>';
        return;
    }

    recebimentoState.manifestos.forEach((manifesto, index) => {
        const manifestoElement = document.createElement('div');
        manifestoElement.className = 'card mb-3';
        manifestoElement.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Manifesto ${index + 1}: ${manifesto.numero_manifesto || 'Sem número'}</h6>
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-outline-primary btn-editar-manifesto" data-index="${index}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger btn-remover-manifesto" data-index="${index}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-3">
                        <strong>Número:</strong><br>
                        <span class="text-primary">${manifesto.numero_manifesto || 'Não informado'}</span>
                    </div>
                    <div class="col-md-2">
                        <strong>Série:</strong><br>
                        ${manifesto.serie}
                    </div>
                    <div class="col-md-2">
                        <strong>Notas:</strong><br>
                        <span class="badge badge-info">${manifesto.notas.length}</span>
                    </div>
                    <div class="col-md-2">
                        <strong>Origem:</strong><br>
                        <small>${manifesto.origem_hub_nome || 'Não informado'}</small>
                    </div>
                    <div class="col-md-2">
                        <strong>Destino:</strong><br>
                        <small>${manifesto.destino_hub_nome || 'Não informado'}</small>
                    </div>
                </div>
                ${manifesto.observacoes ? `<div class="mt-2"><strong>Observações:</strong><br>${manifesto.observacoes}</div>` : ''}
            </div>`;
        lista.appendChild(manifestoElement);
    });
}

function abrirModalEditarManifesto(index) {
    const manifesto = recebimentoState.manifestos[index];
    manifestoEditando = index;

    // Preencher campos do modal
    $('#manifesto-numero').val(manifesto.numero_manifesto);
    $('#manifesto-serie').val(manifesto.serie);
    $('#manifesto-data-emissao').val(manifesto.data_emissao ? manifesto.data_emissao.substring(0, 16) : '');
    $('#manifesto-origem-hub').val(manifesto.origem_hub_nome || '');
    $('#manifesto-destino-hub').val(manifesto.destino_hub_nome || '');

    // Configurar IDs dos hubs se disponíveis
    const origemInput = document.getElementById('manifesto-origem-hub');
    const destinoInput = document.getElementById('manifesto-destino-hub');

    if (origemInput && manifesto.origem_hub_id) {
        origemInput.setAttribute('data-hub-id', manifesto.origem_hub_id);
    }

    if (destinoInput && manifesto.destino_hub_id) {
        destinoInput.setAttribute('data-hub-id', manifesto.destino_hub_id);
    }

    // Atualizar lista de notas
    atualizarListaNotasManifesto(index);

    // Inicializar autocomplete para os campos de hub (importante!)
    inicializarAutocompleteHub('manifesto-origem-hub', 'sugestoes-manifesto-origem');
    inicializarAutocompleteHub('manifesto-destino-hub', 'sugestoes-manifesto-destino');

    $('#modal-editar-manifesto').modal('show');
}

function atualizarListaNotasManifesto(indexManifesto) {
    const listaNotas = document.getElementById('lista-notas-manifesto');
    if (!listaNotas) return;

    listaNotas.innerHTML = '';

    const manifesto = recebimentoState.manifestos[indexManifesto];
    if (!manifesto.notas || manifesto.notas.length === 0) {
        listaNotas.innerHTML = '<div class="text-center text-muted py-3">Nenhuma nota adicionada</div>';
        return;
    }

    manifesto.notas.forEach((nota, indexNota) => {
        const notaElement = document.createElement('div');
        notaElement.className = 'card mb-2';
        notaElement.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Nota ${indexNota + 1}</h6>
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-outline-primary btn-editar-nota-manifesto" data-nota-index="${indexNota}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger btn-remover-nota-manifesto" data-nota-index="${indexNota}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4">
                        <strong>Número:</strong> ${nota.numero || 'Não informado'}
                    </div>
                    <div class="col-md-4">
                        <strong>Série:</strong> ${nota.serie || '1'}
                    </div>
                    <div class="col-md-4">
                        <strong>Itens:</strong> ${nota.itens ? nota.itens.length : 0}
                    </div>
                </div>
            </div>
        `;
        listaNotas.appendChild(notaElement);
    });
}

// ========== FUNÇÕES PARA NOTAS FISCAIS ==========
function adicionarNota(contexto, indexPrincipal) {
    if (contexto === 'manifesto') {
        const index = parseInt(indexPrincipal, 10);
        const manifesto = recebimentoState.manifestos?.[index];

        if (isNaN(index) || index < 0 || !manifesto) {
            console.error('Erro: Manifesto não encontrado no índice:', indexPrincipal);
            mostrarFeedback('Erro: Manifesto não encontrado para adicionar a nota. Verifique se a variável de estado está correta.', 'error');
            return;
        }

        const novaNota = {
            numero: '',
            serie: '1',
            data_emissao: formatarDataParaInput(new Date()),
            pedidos: [],
            itens: []
        };

        if (!manifesto.notas) {
            manifesto.notas = [];
        }

        manifesto.notas.push(novaNota);

        atualizarListaNotasManifesto(index);

        mostrarFeedback(`Nova nota fiscal adicionada com sucesso ao Manifesto ${manifesto.numero_manifesto || index + 1}.`, 'success');

    } else if (contexto === 'pedido') {
        const index = parseInt(indexPrincipal, 10);
        const pedido = recebimentoState.pedidos?.[index];

        if (isNaN(index) || index < 0 || !pedido) {
            console.error('Erro: Pedido não encontrado no índice:', indexPrincipal);
            mostrarFeedback('Erro: Pedido não encontrado para adicionar a nota.', 'error');
            return;
        }

        const novaNota = {
            numero: `NF-${Date.now()}`,
            serie: '1',
            data_emissao: new Date().toISOString(),
            itens: []
        };

        if (!pedido.meta) {
            pedido.meta = { notas: [] };
        }

        if (!pedido.meta.notas) {
            pedido.meta.notas = [];
        }

        pedido.meta.notas.push(novaNota);

        // Atualizar a lista de notas do pedido se estiver no modal de edição
        if (pedidoEditando === index) {
            atualizarListaNotasPedido(index);
        }

        mostrarFeedback(`Nova nota fiscal adicionada com sucesso ao Pedido ${pedido.codigo}.`, 'success');
    } else {
        console.error('Contexto inválido para adicionar nota:', contexto);
        mostrarFeedback('Erro: Contexto inválido para adicionar nota', 'error');
    }
}

function abrirModalEditarNota(contexto, indexPrincipal, indexNota) {
    // VERIFICAÇÃO DE SEGURANÇA
    if (contexto === 'manifesto') {
        if (!recebimentoState.manifestos ||
            !recebimentoState.manifestos[indexPrincipal] ||
            !recebimentoState.manifestos[indexPrincipal].notas ||
            !recebimentoState.manifestos[indexPrincipal].notas[indexNota]) {

            console.error('Nota não encontrada no manifesto:', indexPrincipal, indexNota);
            mostrarFeedback('Erro: Nota não encontrada no manifesto', 'error');
            return;
        }
    } else if (contexto === 'pedido') {
        if (!recebimentoState.pedidos ||
            !recebimentoState.pedidos[indexPrincipal] ||
            !recebimentoState.pedidos[indexPrincipal].meta ||
            !recebimentoState.pedidos[indexPrincipal].meta.notas ||
            !recebimentoState.pedidos[indexPrincipal].meta.notas[indexNota]) {

            console.error('Nota não encontrada no pedido:', indexPrincipal, indexNota);
            mostrarFeedback('Erro: Nota não encontrada no pedido', 'error');
            return;
        }
    } else {
        console.error('Contexto inválido:', contexto);
        return;
    }

    let nota;

    if (contexto === 'manifesto') {
        nota = recebimentoState.manifestos[indexPrincipal].notas[indexNota];
        notaEditando = {
            contexto: 'manifesto',
            indexManifesto: indexPrincipal,
            indexNota: indexNota
        };
    } else if (contexto === 'pedido') {
        nota = recebimentoState.pedidos[indexPrincipal].meta.notas[indexNota];
        notaEditando = {
            contexto: 'pedido',
            indexPedido: indexPrincipal,
            indexNota: indexNota
        };
    }

    $('#nota-numero').val(nota.numero);
    $('#nota-serie').val(nota.serie);
    $('#nota-data-emissao').val(formatarDataParaInput(nota.data_emissao));

    // Atualizar lista de pedidos da nota (se for do contexto manifesto)
    if (contexto === 'manifesto') {
        atualizarListaPedidosNota(indexPrincipal, indexNota);
    } else {
        // Para notas do pedido, limpar a lista de pedidos
        const listaPedidos = document.getElementById('lista-pedidos-nota');
        if (listaPedidos) {
            listaPedidos.innerHTML = '<div class="text-center text-muted py-3">Notas de pedidos não possuem lista de pedidos separada.</div>';
        }
    }

    // Atualizar lista de itens da nota
    atualizarListaItensNota(contexto, indexPrincipal, indexNota);

    $('#modal-editar-nota').modal('show');
}
function atualizarListaPedidosNota(indexManifesto, indexNota) {
    const listaPedidos = document.getElementById('lista-pedidos-nota');
    if (!listaPedidos) return;

    listaPedidos.innerHTML = '';

    // VERIFICAÇÃO DE SEGURANÇA ADICIONADA
    if (!recebimentoState.manifestos ||
        !recebimentoState.manifestos[indexManifesto] ||
        !recebimentoState.manifestos[indexManifesto].notas ||
        !recebimentoState.manifestos[indexManifesto].notas[indexNota]) {

        console.warn('Nota não encontrada nos índices:', indexManifesto, indexNota);
        listaPedidos.innerHTML = '<div class="text-center text-muted py-3">Nota não encontrada ou sem pedidos vinculados</div>';
        return;
    }

    const nota = recebimentoState.manifestos[indexManifesto].notas[indexNota];
    const pedidos = nota.pedidos || [];

    if (pedidos.length === 0) {
        listaPedidos.innerHTML = '<div class="text-center text-muted py-3">Nenhum pedido vinculado à esta nota.</div>';
        return;
    }

    pedidos.forEach((pedido) => {
        const exists = pedido.exists || false;
        const qtdItens = pedido.itens ? pedido.itens.length : 0;
        const clienteNome = pedido.meta?.cliente?.nome || 'N/A';

        const pedidoElement = document.createElement('div');
        pedidoElement.className = `card mb-2 ${exists ? '' : 'border-warning'}`;
        pedidoElement.innerHTML = `
            <div class="card-header py-2 d-flex justify-content-between align-items-center">
                <h6 class="mb-0 text-dark">
                    <i class="fas fa-barcode"></i> ${pedido.codigo}
                    <span class="badge ${exists ? 'badge-success' : 'badge-warning'} ml-2 small">
                        ${exists ? 'Existente' : 'Inexistente'}
                    </span>
                </h6>
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-outline-primary btn-editar-pedido-nota" 
                            data-codigo-pedido="${pedido.codigo}">
                        <i class="fas fa-edit"></i> Editar Detalhes
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger btn-remover-pedido-nota" 
                            data-codigo-pedido="${pedido.codigo}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="card-body py-2 small">
                Itens: ${qtdItens} | Cliente: ${clienteNome}
            </div>
        `;
        listaPedidos.appendChild(pedidoElement);
    });

    // Configurar eventos para os botões recém-criados
    configurarEventosPedidosNota();
}

function configurarEventosPedidosNota() {
    // Configurar eventos para editar pedido da nota
    const botoesEditar = document.querySelectorAll('.btn-editar-pedido-nota');
    botoesEditar.forEach(botao => {
        botao.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const codigoPedido = this.getAttribute('data-codigo-pedido');
            if (codigoPedido) {
                const indexGlobal = recebimentoState.pedidos.findIndex(p => p.codigo === codigoPedido);
                if (indexGlobal !== -1) {
                    abrirModalEditarPedidoRecebimento(indexGlobal);
                } else {
                    console.error('Pedido não encontrado:', codigoPedido);
                    mostrarFeedback('Pedido não encontrado na lista de pedidos', 'error');
                }
            }
        });
    });

    // Configurar eventos para remover pedido da nota
    const botoesRemover = document.querySelectorAll('.btn-remover-pedido-nota');
    botoesRemover.forEach(botao => {
        botao.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const codigoPedido = this.getAttribute('data-codigo-pedido');
            if (codigoPedido && notaEditando) {
                const { indexManifesto, indexNota } = notaEditando;
                removerPedidoDaNota(indexManifesto, indexNota, codigoPedido);
            }
        });
    });
}

function abrirModalEditarPedidoRecebimento(indexGlobal) {
    pedidoEditando = indexGlobal;
    const pedido = recebimentoState.pedidos[indexGlobal];

    $('#editar-pedido-codigo').text(pedido.codigo);
    $('#pedido-codigo').val(pedido.codigo).prop('disabled', true); // Desabilitar edição do código

    const container = document.getElementById('itens-pedido-container');
    const nenhumItemMensagem = document.getElementById('nenhum-item-mensagem');

    if (container) {
        container.innerHTML = '';

        if (nenhumItemMensagem) {
            nenhumItemMensagem.style.display = 'none';
        }

        if (pedido.itens && Array.isArray(pedido.itens) && pedido.itens.length > 0) {
            pedido.itens.forEach(item => {
                adicionarItemPedidoUI(item);
            });
        } else {
            if (nenhumItemMensagem) {
                nenhumItemMensagem.style.display = 'block';
            }
        }
    }

    // Preencher dados do cliente
    const meta = pedido.meta || {};
    const cliente = meta.cliente || {};
    const endereco = meta.endereco || {};

    $('#meta-cliente-nome').val(cliente.nome || '');
    $('#meta-cliente-cpf').val(cliente.cpf || cliente.cnpj || '');
    $('#meta-cliente-email').val(cliente.email || '');
    $('#meta-cliente-telefone').val(cliente.telefone || '');

    $('#meta-endereco-cep').val(endereco.cep || '');
    $('#meta-endereco-rua').val(endereco.rua || '');
    $('#meta-endereco-numero').val(endereco.numero || '');
    $('#meta-endereco-complemento').val(endereco.complemento || '');
    $('#meta-endereco-bairro').val(endereco.bairro || '');
    $('#meta-endereco-cidade').val(endereco.cidade || '');
    $('#meta-endereco-estado').val(endereco.estado || '');

    // Preencher notasMeta
    atualizarListaNotasPedido(indexGlobal);

    // Preencher manifesto associado
    $('#pedido-manifesto-numero').val(pedido.meta?.manifesto_numero || '');

    // Configurar eventos dos botões
    const btnAdicionarItem = document.getElementById('btn-adicionar-item-pedido');
    if (btnAdicionarItem) {
        btnAdicionarItem.onclick = () => adicionarItemPedidoUI();
    }

    const btnAdicionarNota = document.getElementById('btn-adicionar-nota-pedido');
    if (btnAdicionarNota) {
        btnAdicionarNota.onclick = () => adicionarNotaPedido();
    }

    const btnSalvar = document.getElementById('btn-salvar-pedido-edicao');
    if (btnSalvar) {
        btnSalvar.onclick = salvarPedidoRecebimento;
    }

    $('#modal-editar-pedido-recebimento').modal('show');
}

function adicionarNotaPedido() {
    if (pedidoEditando === null) {
        mostrarFeedback('Nenhum pedido em edição', 'error');
        return;
    }

    const pedido = recebimentoState.pedidos[pedidoEditando];
    if (!pedido.meta) {
        pedido.meta = {};
    }
    if (!pedido.meta.notas) {
        pedido.meta.notas = [];
    }

    // Verificar se já existe uma nota com número padrão
    const numeroNota = `NF-${Date.now()}`;
    const serieNota = '1';

    // Copiar itens do pedido para a nova nota
    const itensNota = pedido.itens && pedido.itens.length > 0
        ? pedido.itens.map(item => ({
            produto: {
                nome: item.produto?.nome || '',
                descricao: item.produto?.descricao || null,
                s_n: item.produto?.s_n || null,
                p_n: item.produto?.p_n || null,
                preco: parseFloat(item.produto?.preco) || 0,
                peso_kg: parseFloat(item.produto?.peso_kg) || 0
            },
            quantidade: parseInt(item.quantidade) || 1,
            valor_unitario: parseFloat(item.valor_unitario) || 0,
            descricao: item.descricao || null
        }))
        : [];

    const novaNota = {
        numero: numeroNota,
        serie: serieNota,
        data_emissao: new Date().toISOString(),
        itens: itensNota
    };

    // Verificar se o pedido tem manifesto associado
    if (pedido.meta?.manifesto_numero) {
        const manifestoNumero = pedido.meta.manifesto_numero;
        const manifesto = recebimentoState.manifestos.find(m => m.numero_manifesto === manifestoNumero);

        if (manifesto) {
            if (!manifesto.notas) {
                manifesto.notas = [];
            }

            // Adicionar cópia da nota ao manifesto
            manifesto.notas.push({
                ...novaNota,
                itens: itensNota.map(item => ({ ...item })) // Cópia profunda
            });

            console.debug(`Nota também adicionada ao manifesto ${manifestoNumero}`);
        }
    }

    pedido.meta.notas.push(novaNota);
    atualizarListaNotasPedido(pedidoEditando);
    mostrarFeedback('Nota fiscal adicionada ao pedido (e ao manifesto, se aplicável)', 'success');
}

function salvarPedidoRecebimento() {
    if (pedidoEditando === null) {
        mostrarFeedback('Nenhum pedido em edição', 'error');
        return;
    }

    try {
        const pedido = recebimentoState.pedidos[pedidoEditando];

        const container = document.getElementById('itens-pedido-container');
        const itemCards = container.querySelectorAll('.item-pedido-card');
        pedido.itens = [];

        if (itemCards.length === 0) {
            mostrarFeedback('Adicione pelo menos um item ao pedido', 'error');
            return;
        }

        let itemValido = true;
        itemCards.forEach(card => {
            const nome = safeTrim(card.querySelector('.item-produto-nome').value);
            const quantidade = parseInt(card.querySelector('.item-quantidade').value);
            const valorUnitario = parseFloat(card.querySelector('.item-valor-unitario').value);

            if (!nome || !quantidade || quantidade < 1 || isNaN(valorUnitario) || valorUnitario < 0) {
                itemValido = false;
                const index = Array.from(itemCards).indexOf(card) + 1;
                mostrarFeedback(`Erro: Preencha todos os campos obrigatórios (Nome, Qtd, Valor Unit.) no item ${index}`, 'error');
                return;
            }

            const novoItem = {
                produto: {
                    nome: nome,
                    descricao: safeTrim(card.querySelector('.item-produto-descricao').value),
                    s_n: safeTrim(card.querySelector('.item-produto-sn').value),
                    p_n: safeTrim(card.querySelector('.item-produto-pn').value),
                    preco: parseFloat(card.querySelector('.item-produto-preco').value) || 0,
                    peso_kg: parseFloat(card.querySelector('.item-produto-peso').value) || 0
                },
                quantidade: quantidade,
                valor_unitario: valorUnitario,
                descricao: safeTrim(card.querySelector('.item-descricao').value)
            };
            pedido.itens.push(novoItem);
        });

        if (!itemValido) {
            return;
        }

        pedido.meta = pedido.meta || {};
        pedido.meta.cliente = {
            nome: safeTrim($('#meta-cliente-nome').val()),
            cpf: safeTrim($('#meta-cliente-cpf').val()),
            email: safeTrim($('#meta-cliente-email').val()),
            telefone: safeTrim($('#meta-cliente-telefone').val())
        };

        pedido.meta.endereco = {
            cep: safeTrim($('#meta-endereco-cep').val()),
            rua: safeTrim($('#meta-endereco-rua').val()),
            numero: safeTrim($('#meta-endereco-numero').val()),
            complemento: safeTrim($('#meta-endereco-complemento').val()),
            bairro: safeTrim($('#meta-endereco-bairro').val()),
            cidade: safeTrim($('#meta-endereco-cidade').val()),
            estado: safeTrim($('#meta-endereco-estado').val())
        };

        pedido.meta.manifesto_numero = safeTrim($('#pedido-manifesto-numero').val()) || undefined;

        // Preservar notas existentes se houver
        if (!pedido.meta.notas) {
            pedido.meta.notas = [];
        }

        $('#modal-editar-pedido-recebimento').modal('hide');

        // VERIFICAÇÃO DE SEGURANÇA ADICIONADA
        if (notaEditando &&
            notaEditando.contexto === 'manifesto' &&
            typeof notaEditando.indexManifesto === 'number' &&
            typeof notaEditando.indexNota === 'number' &&
            recebimentoState.manifestos &&
            recebimentoState.manifestos[notaEditando.indexManifesto] &&
            recebimentoState.manifestos[notaEditando.indexManifesto].notas &&
            recebimentoState.manifestos[notaEditando.indexManifesto].notas[notaEditando.indexNota]) {

            atualizarListaPedidosNota(notaEditando.indexManifesto, notaEditando.indexNota);
        } else {
            atualizarListaPedidosRecebimento();
        }

        mostrarFeedback(`Detalhes do Pedido ${pedido.codigo} salvos com sucesso.`, 'success');

    } catch (error) {
        console.error('Erro ao salvar pedido:', error);
        mostrarFeedback(`Erro ao salvar pedido: ${error.message}`, 'error');
    }
}

function removerPedidoDaNota(indexManifesto, indexNota, codigoPedido) {
    const nota = recebimentoState.manifestos[indexManifesto].notas[indexNota];

    const initialLength = nota.pedidos.length;
    nota.pedidos = nota.pedidos.filter(p => p.codigo !== codigoPedido);

    if (initialLength !== nota.pedidos.length) {
        let estaEmOutraNota = recebimentoState.manifestos.some(m => {
            return m.notas.some(n => n.pedidos.some(p => p.codigo === codigoPedido));
        });

        if (!estaEmOutraNota) {
            recebimentoState.pedidos = recebimentoState.pedidos.filter(p => p.codigo !== codigoPedido);
        }

        atualizarListaPedidosNota(indexManifesto, indexNota);
        mostrarFeedback('Pedido desvinculado da nota.', 'success');
    } else {
        mostrarFeedback('Erro ao remover pedido: código não encontrado na nota.', 'error');
    }
}

async function adicionarPedidoNaNota() {
    if (!notaEditando) return;

    const codigoInput = document.getElementById('input-pedido-nota');
    const codigo = safeTrim(codigoInput.value);

    if (!codigo) {
        mostrarFeedback('Informe o código do pedido', 'error');
        return;
    }

    const { indexManifesto, indexNota } = notaEditando;
    const nota = recebimentoState.manifestos[indexManifesto].notas[indexNota];

    if (nota.pedidos.some(p => p.codigo === codigo)) {
        mostrarFeedback('Pedido já adicionado a esta nota', 'warning');
        return;
    }

    let pedidoGlobal = recebimentoState.pedidos.find(p => p.codigo === codigo);
    let exists = false;

    if (pedidoGlobal) {
        exists = pedidoGlobal.exists;
    } else {
        exists = await validarPedidoExistente(codigo);

        pedidoGlobal = {
            codigo: codigo,
            exists: exists,
            itens: [],
            meta: {
                cliente: {},
                endereco: {},
            }
        };
        recebimentoState.pedidos.push(pedidoGlobal);
    }

    const pedidoParaNota = pedidoGlobal;
    nota.pedidos.push(pedidoParaNota);

    atualizarListaPedidosNota(indexManifesto, indexNota);
    codigoInput.value = '';

    mostrarFeedback(`Pedido ${codigo} vinculado com sucesso.`, 'success');
}

function atualizarListaItensNota(contexto, indexPrincipal, indexNota) {
    const listaitens = document.getElementById('lista-itens-nota');
    if (!listaitens) return;

    listaitens.innerHTML = '';

    let nota;
    if (contexto === 'manifesto') {
        nota = recebimentoState.manifestos[indexPrincipal].notas[indexNota];
    } else if (contexto === 'pedido') {
        const pedido = recebimentoState.pedidos[indexPrincipal];
        nota = pedido.meta.notas[indexNota];
    }

    if (!nota.itens || nota.itens.length === 0) {
        listaitens.innerHTML = '<div class="text-center text-muted py-3">Nenhum item adicionado</div>';
        return;
    }

    nota.itens.forEach((item, indexItem) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'card mb-2';
        itemElement.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Item ${indexItem + 1}</h6>
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-outline-primary btn-editar-item-nota" data-item-index="${indexItem}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger btn-remover-item-nota" data-item-index="${indexItem}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4">
                        <strong>Produto:</strong> ${item.produto?.nome || 'Não informado'}
                    </div>
                    <div class="col-md-4">
                        <strong>Quantidade:</strong> ${item.quantidade || 0}
                    </div>
                    <div class="col-md-4">
                        <strong>Valor Unit.:</strong> ${formatarMoeda(item.valor_unitario)}
                    </div>
                </div>
            </div>
        `;
        listaitens.appendChild(itemElement);
    });
}

// ========== FUNÇÕES PARA ITENS DE NOTA ==========
function adicionarItemNota(contexto, indexPrincipal, indexNota) {
    const novoItem = {
        produto: {
            nome: '',
            descricao: '',
            s_n: '',
            p_n: '',
            preco: 0,
            peso_kg: 0
        },
        quantidade: 1,
        valor_unitario: 0,
        descricao: ''
    };

    if (contexto === 'manifesto') {
        if (!recebimentoState.manifestos[indexPrincipal].notas[indexNota].itens) {
            recebimentoState.manifestos[indexPrincipal].notas[indexNota].itens = [];
        }
        recebimentoState.manifestos[indexPrincipal].notas[indexNota].itens.push(novoItem);
    } else if (contexto === 'pedido') {
        const pedido = recebimentoState.pedidos[indexPrincipal];
        if (!pedido.meta.notas[indexNota].itens) {
            pedido.meta.notas[indexNota].itens = [];
        }
        pedido.meta.notas[indexNota].itens.push(novoItem);
    }

    atualizarListaItensNota(contexto, indexPrincipal, indexNota);
}

function abrirModalEditarItemNota(contexto, indexPrincipal, indexNota, indexItem) {
    let item;
    if (contexto === 'manifesto') {
        item = recebimentoState.manifestos[indexPrincipal].notas[indexNota].itens[indexItem];
    } else if (contexto === 'pedido') {
        item = recebimentoState.pedidos[indexPrincipal].meta.notas[indexNota].itens[indexItem];
    }

    itemNotaEditando = { contexto, indexPrincipal, indexNota, indexItem };

    $('#item-nota-produto-nome').val(item.produto?.nome || '');
    $('#item-nota-produto-descricao').val(item.produto?.descricao || '');
    $('#item-nota-produto-sn').val(item.produto?.s_n || '');
    $('#item-nota-produto-pn').val(item.produto?.p_n || '');
    $('#item-nota-quantidade').val(item.quantidade);
    $('#item-nota-valor-unitario').val(item.valor_unitario);
    $('#item-nota-produto-preco').val(item.produto?.preco || '');
    $('#item-nota-produto-peso').val(item.produto?.peso_kg || '');
    $('#item-nota-descricao').val(item.descricao || '');

    $('#modal-editar-item-nota').modal('show');
}

// ========== FUNÇÕES PARA SALVAR EDIÇÕES ==========
function salvarManifesto() {
    if (manifestoEditando === null) return;

    const manifesto = recebimentoState.manifestos[manifestoEditando];
    manifesto.numero_manifesto = safeTrim($('#manifesto-numero').val());
    manifesto.serie = safeTrim($('#manifesto-serie').val());
    manifesto.data_emissao = $('#manifesto-data-emissao').val();
    manifesto.origem_hub_nome = safeTrim($('#manifesto-origem-hub').val());
    manifesto.destino_hub_nome = safeTrim($('#manifesto-destino-hub').val());

    // Obter IDs dos hubs
    const origemInput = document.getElementById('manifesto-origem-hub');
    const destinoInput = document.getElementById('manifesto-destino-hub');

    manifesto.origem_hub_id = origemInput?.getAttribute('data-hub-id') || null;
    manifesto.destino_hub_id = destinoInput?.getAttribute('data-hub-id') || null;

    $('#modal-editar-manifesto').modal('hide');
    atualizarListaManifestos();
    mostrarFeedback('Manifesto salvo com sucesso', 'success');
}

function salvarNota() {
    if (!notaEditando) return;

    if (notaEditando.contexto === 'manifesto') {
        const { indexManifesto, indexNota } = notaEditando;
        const nota = recebimentoState.manifestos[indexManifesto].notas[indexNota];

        nota.numero = safeTrim($('#nota-numero').val());
        nota.serie = safeTrim($('#nota-serie').val());
        nota.data_emissao = $('#nota-data-emissao').val();

        atualizarListaNotasManifesto(indexManifesto);
    } else if (notaEditando.contexto === 'pedido') {
        const { indexPedido, indexNota } = notaEditando;
        const pedido = recebimentoState.pedidos[indexPedido];

        if (!pedido.meta.notas) {
            pedido.meta.notas = [];
        }

        pedido.meta.notas[indexNota].numero = safeTrim($('#nota-numero').val());
        pedido.meta.notas[indexNota].serie = safeTrim($('#nota-serie').val());
        pedido.meta.notas[indexNota].data_emissao = $('#nota-data-emissao').val();

        atualizarListaNotasPedido(indexPedido);
    }

    $('#modal-editar-nota').modal('hide');
    mostrarFeedback('Nota salva com sucesso', 'success');
}

function salvarItemNota() {
    if (!itemNotaEditando) return;

    const { contexto, indexPrincipal, indexNota, indexItem } = itemNotaEditando;
    let item;

    if (contexto === 'manifesto') {
        item = recebimentoState.manifestos[indexPrincipal].notas[indexNota].itens[indexItem];
    } else if (contexto === 'pedido') {
        item = recebimentoState.pedidos[indexPrincipal].meta.notas[indexNota].itens[indexItem];
    }

    const produtoNome = safeTrim($('#item-nota-produto-nome').val());
    const quantidade = parseInt($('#item-nota-quantidade').val());
    const valorUnitario = parseFloat($('#item-nota-valor-unitario').val());

    if (!produtoNome) {
        mostrarFeedback('Nome do produto é obrigatório', 'error');
        return;
    }

    if (!quantidade || quantidade < 1) {
        mostrarFeedback('Quantidade deve ser pelo menos 1', 'error');
        return;
    }

    if (!valorUnitario || valorUnitario < 0) {
        mostrarFeedback('Valor unitário deve ser maior ou igual a 0', 'error');
        return;
    }

    item.produto = {
        nome: produtoNome,
        descricao: safeTrim($('#item-nota-produto-descricao').val()),
        s_n: safeTrim($('#item-nota-produto-sn').val()),
        p_n: safeTrim($('#item-nota-produto-pn').val()),
        preco: parseFloat($('#item-nota-produto-preco').val()) || 0,
        peso_kg: parseFloat($('#item-nota-produto-peso').val()) || 0
    };
    item.quantidade = quantidade;
    item.valor_unitario = valorUnitario;
    item.descricao = safeTrim($('#item-nota-descricao').val());

    $('#modal-editar-item-nota').modal('hide');
    atualizarListaItensNota(contexto, indexPrincipal, indexNota);
    mostrarFeedback('Item salvo com sucesso', 'success');
}

// ========== FUNÇÕES PARA PEDIDOS ==========
async function adicionarPedidoRecebimento() {
    let codigoInput = document.getElementById('novo-recebimento-codigo-pedido');
    if (!codigoInput) {
        codigoInput = document.createElement('input');
        codigoInput.id = 'novo-recebimento-codigo-pedido-temp';
        codigoInput.type = 'text';
        codigoInput.className = 'form-control';
        codigoInput.placeholder = 'Código do pedido';
    }

    const codigo = safeTrim(codigoInput.value);

    if (!codigo) {
        mostrarFeedback('Informe o código do pedido', 'error');
        return;
    }

    if (recebimentoState.pedidos.find(p => p.codigo === codigo)) {
        mostrarFeedback('Pedido já adicionado à lista', 'warning');
        return;
    }

    const pedidoExiste = await validarPedidoExistente(codigo);

    const createMissingCheckbox = document.getElementById('create-missing-pedidos');
    if (!pedidoExiste && !(createMissingCheckbox && createMissingCheckbox.checked)) {
        const confirmar = confirm(`Pedido ${codigo} não encontrado. Deseja marcar "Create Missing Pedidos" para criar automaticamente?`);
        if (confirmar && createMissingCheckbox) {
            createMissingCheckbox.checked = true;
        } else {
            return;
        }
    }

    const novoPedido = {
        codigo: codigo,
        exists: pedidoExiste,
        itens: [],
        meta: {
            cliente: {},
            endereco: {},
            notas: []
        }
    };

    recebimentoState.pedidos.push(novoPedido);
    atualizarListaPedidosRecebimento();

    if (codigoInput && codigoInput.id !== 'novo-recebimento-codigo-pedido-temp') {
        codigoInput.value = '';
    }

    mostrarFeedback(`Pedido ${codigo} adicionado ${pedidoExiste ? '(existente)' : '(será criado)'}`, 'success');
}

function atualizarListaPedidosRecebimento() {
    const lista = document.getElementById('lista-pedidos-recebimento');
    if (!lista) return;

    lista.innerHTML = '';

    recebimentoState.pedidos.forEach((pedido, index) => {
        const temItens = pedido.itens && pedido.itens.length > 0;
        const temMeta = pedido.meta !== null;
        const qtdItens = temItens ? pedido.itens.length : 0;
        const qtdNotas = pedido.meta && pedido.meta.notas ? pedido.meta.notas.length : 0;

        const pedidoElement = document.createElement('div');
        pedidoElement.className = `pedido-item card mb-2 ${pedido.exists ? '' : 'border-warning'}`;
        pedidoElement.innerHTML = `
            <div class="card-body py-2">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${escapeHtml(pedido.codigo)}</strong>
                        <span class="badge ${pedido.exists ? 'badge-success' : 'badge-warning'} ml-2">
                            ${pedido.exists ? 'Existente' : 'Inexistente'}
                        </span>
                        <div class="small text-muted">
                            Itens: ${qtdItens} | Notas: ${qtdNotas}
                        </div>
                        <div class="small text-muted">
                            ${temMeta ? '✓ Cliente/Endereço' : '✗ Cliente/Endereço'}
                        </div>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button type="button" class="btn btn-outline-primary btn-editar-pedido" data-index="${index}">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button type="button" class="btn btn-outline-danger btn-remover-pedido" data-index="${index}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        lista.appendChild(pedidoElement);
    });
}

function abrirModalEditarPedido(index) {
    pedidoEditando = index;
    const pedido = recebimentoState.pedidos[index];

    $('#modal-editar-pedido-recebimento').text(pedido.codigo);
    $('#editar-pedido-codigo').val(pedido.codigo);

    const container = document.getElementById('itens-pedido-container');
    if (container) {
        container.innerHTML = '<div class="text-center text-muted py-3" id="nenhum-item-mensagem">Nenhum item adicionado. Clique em "Adicionar Item" para começar.</div>';
    }

    if (pedido.itens && Array.isArray(pedido.itens)) {
        pedido.itens.forEach(item => {
            adicionarItemPedidoUI(item);
        });
    }

    if (pedido.meta) {
        if (pedido.meta.cliente) {
            $('#meta-cliente-nome').val(pedido.meta.cliente.nome || '');
            $('#meta-cliente-cpf').val(pedido.meta.cliente.cpf || pedido.meta.cliente.cnpj || '');
            $('#meta-cliente-email').val(pedido.meta.cliente.email || '');
            $('#meta-cliente-telefone').val(pedido.meta.cliente.telefone || '');
        }

        if (pedido.meta.endereco) {
            $('#meta-endereco-cep').val(pedido.meta.endereco.cep || '');
            $('#meta-endereco-rua').val(pedido.meta.endereco.rua || '');
            $('#meta-endereco-numero').val(pedido.meta.endereco.numero || '');
            $('#meta-endereco-complemento').val(pedido.meta.endereco.complemento || '');
            $('#meta-endereco-bairro').val(pedido.meta.endereco.bairro || '');
            $('#meta-endereco-cidade').val(pedido.meta.endereco.cidade || '');
            $('#meta-endereco-estado').val(pedido.meta.endereco.estado || '');
        }

        if (pedido.meta.manifesto_numero) {
            $('#pedido-manifesto-numero').val(pedido.meta.manifesto_numero);
        }
    } else {
        $('#meta-cliente-nome').val('');
        $('#meta-cliente-cpf').val('');
        $('#meta-cliente-email').val('');
        $('#meta-cliente-telefone').val('');
        $('#meta-endereco-cep').val('');
        $('#meta-endereco-rua').val('');
        $('#meta-endereco-numero').val('');
        $('#meta-endereco-complemento').val('');
        $('#meta-endereco-bairro').val('');
        $('#meta-endereco-cidade').val('');
        $('#meta-endereco-estado').val('');
        $('#pedido-manifesto-numero').val('');
    }

    atualizarListaNotasPedido(index);

    $('#modal-editar-pedido-recebimento').modal('show');
}

function adicionarItemPedidoUI(itemData = {}) {
    const container = document.getElementById('itens-pedido-container');
    const nenhumItemMensagem = document.getElementById('nenhum-item-mensagem');

    if (!container) return;

    if (nenhumItemMensagem) {
        nenhumItemMensagem.style.display = 'none';
    }

    const itemIndex = container.querySelectorAll('.item-pedido-card').length;
    const itemId = `item-pedido-${itemIndex}`;

    const itemHTML = `
        <div class="item-pedido-card card mb-3" id="${itemId}">
            <div class="card-header bg-light d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Item do Pedido #${itemIndex + 1}</h6>
                <button type="button" class="btn btn-sm btn-danger btn-remover-item-pedido" data-item-id="${itemId}">
                    <i class="fas fa-times"></i> Remover
                </button>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Nome do Produto *</label>
                            <input type="text" class="form-control item-produto-nome" 
                                   value="${itemData.produto?.nome || ''}" 
                                   placeholder="Nome do produto" required>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Descrição do Produto</label>
                            <input type="text" class="form-control item-produto-descricao" 
                                   value="${itemData.produto?.descricao || ''}" 
                                   placeholder="Descrição do produto">
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Serial Number (S/N)</label>
                            <input type="text" class="form-control item-produto-sn" 
                                   value="${itemData.produto?.s_n || ''}" 
                                   placeholder="S/N">
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Part Number (P/N)</label>
                            <input type="text" class="form-control item-produto-pn" 
                                   value="${itemData.produto?.p_n || ''}" 
                                   placeholder="P/N">
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Quantidade *</label>
                            <input type="number" class="form-control item-quantidade" 
                                   value="${itemData.quantidade || ''}" 
                                   placeholder="0" min="1" required>
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Valor Unitário (R$) *</label>
                            <input type="number" step="0.01" class="form-control item-valor-unitario" 
                                   value="${itemData.valor_unitario || ''}" 
                                   placeholder="0.00" min="0" required>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Preço do Produto (R$)</label>
                            <input type="number" step="0.01" class="form-control item-produto-preco" 
                                   value="${itemData.produto?.preco || ''}" 
                                   placeholder="0.00">
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Peso (kg)</label>
                            <input type="number" step="0.01" class="form-control item-produto-peso" 
                                   value="${itemData.produto?.peso_kg || ''}" 
                                   placeholder="0.00">
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Descrição do Item</label>
                    <input type="text" class="form-control item-descricao" 
                           value="${itemData.descricao || ''}" 
                           placeholder="Descrição detalhada do item">
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', itemHTML);

    const removeBtn = document.querySelector(`[data-item-id="${itemId}"]`);
    if (removeBtn) {
        removeBtn.addEventListener('click', function () {
            const itemToRemove = document.getElementById(itemId);
            if (itemToRemove) {
                itemToRemove.remove();

                if (container.querySelectorAll('.item-pedido-card').length === 0) {
                    const nenhumItemMensagem = document.getElementById('nenhum-item-mensagem');
                    if (nenhumItemMensagem) {
                        nenhumItemMensagem.style.display = 'block';
                    }
                }
            }
        });
    }
}

function atualizarListaNotasPedido(indexPedido) {
    const listaNotas = document.getElementById('lista-notas-pedido');
    if (!listaNotas) return;

    listaNotas.innerHTML = '';

    const pedido = recebimentoState.pedidos[indexPedido];
    const notas = pedido.meta?.notas || [];

    if (notas.length === 0) {
        listaNotas.innerHTML = '<div class="text-center text-muted py-3">Nenhuma nota fiscal adicionada</div>';
        return;
    }

    notas.forEach((nota, indexNota) => {
        const qtdItens = nota.itens ? nota.itens.length : 0;
        const dataEmissao = nota.data_emissao ? formatarData(nota.data_emissao) : 'Não informada';

        const notaElement = document.createElement('div');
        notaElement.className = 'card mb-3';
        notaElement.innerHTML = `
            <div class="card-header bg-light d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Nota Fiscal: ${nota.numero || 'Não informado'}</h6>
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-outline-primary btn-editar-nota-pedido" 
                            data-nota-index="${indexNota}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger btn-remover-nota-pedido" 
                            data-nota-index="${indexNota}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4">
                        <strong>Série:</strong> ${nota.serie || '1'}
                    </div>
                    <div class="col-md-4">
                        <strong>Itens:</strong> ${qtdItens}
                    </div>
                    <div class="col-md-4">
                        <strong>Data:</strong> ${dataEmissao}
                    </div>
                </div>
            </div>
        `;
        listaNotas.appendChild(notaElement);
    });

    // Configurar eventos para as notas do pedido
    configurarEventosNotasPedido();
}

function configurarEventosNotasPedido() {
    // Configurar eventos para editar nota do pedido
    const botoesEditarNota = document.querySelectorAll('.btn-editar-nota-pedido');
    botoesEditarNota.forEach(botao => {
        botao.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const indexNota = parseInt(this.getAttribute('data-nota-index'));
            if (pedidoEditando !== null && !isNaN(indexNota)) {
                abrirModalEditarNota('pedido', pedidoEditando, indexNota);
            }
        });
    });

    // Configurar eventos para remover nota do pedido
    const botoesRemoverNota = document.querySelectorAll('.btn-remover-nota-pedido');
    botoesRemoverNota.forEach(botao => {
        botao.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const indexNota = parseInt(this.getAttribute('data-nota-index'));
            if (pedidoEditando !== null && !isNaN(indexNota)) {
                recebimentoState.pedidos[pedidoEditando].meta.notas.splice(indexNota, 1);
                atualizarListaNotasPedido(pedidoEditando);
                mostrarFeedback('Nota fiscal removida do pedido', 'success');
            }
        });
    });
}

function salvarPedidoEditado() {
    if (pedidoEditando === null) {
        mostrarFeedback('Nenhum pedido em edição', 'error');
        return;
    }

    try {
        const clienteNome = safeTrim($('#meta-cliente-nome').val());
        if (!clienteNome) {
            mostrarFeedback('Nome do cliente é obrigatório', 'error');
            $('#meta-cliente-nome').focus();
            return;
        }

        const itens = [];
        const itensElements = document.querySelectorAll('.item-pedido-card');

        if (itensElements.length === 0) {
            mostrarFeedback('Adicione pelo menos um item ao pedido', 'error');
            return;
        }

        let hasErrors = false;

        itensElements.forEach((itemElement, index) => {
            const produtoNome = safeTrim(itemElement.querySelector('.item-produto-nome')?.value);
            const quantidade = safeTrim(itemElement.querySelector('.item-quantidade')?.value);
            const valorUnitario = safeTrim(itemElement.querySelector('.item-valor-unitario')?.value);

            if (!produtoNome) {
                mostrarFeedback(`Nome do produto é obrigatório no item ${index + 1}`, 'error');
                itemElement.querySelector('.item-produto-nome')?.focus();
                hasErrors = true;
                return;
            }

            if (!quantidade || parseInt(quantidade) < 1) {
                mostrarFeedback(`Quantidade deve ser pelo menos 1 no item ${index + 1}`, 'error');
                itemElement.querySelector('.item-quantidade')?.focus();
                hasErrors = true;
                return;
            }

            if (!valorUnitario || parseFloat(valorUnitario) < 0) {
                mostrarFeedback(`Valor unitário deve ser maior ou igual a 0 no item ${index + 1}`, 'error');
                itemElement.querySelector('.item-valor-unitario')?.focus();
                hasErrors = true;
                return;
            }

            const item = {
                produto: {
                    nome: produtoNome,
                    descricao: safeTrim(itemElement.querySelector('.item-produto-descricao')?.value),
                    s_n: safeTrim(itemElement.querySelector('.item-produto-sn')?.value),
                    p_n: safeTrim(itemElement.querySelector('.item-produto-pn')?.value),
                    preco: parseFloat(itemElement.querySelector('.item-produto-preco')?.value) || 0,
                    peso_kg: parseFloat(itemElement.querySelector('.item-produto-peso')?.value) || 0
                },
                quantidade: parseInt(quantidade),
                valor_unitario: parseFloat(valorUnitario),
                descricao: safeTrim(itemElement.querySelector('.item-descricao')?.value)
            };

            itens.push(item);
        });

        if (hasErrors) {
            return;
        }

        const meta = {
            cliente: {
                nome: clienteNome,
                cpf: safeTrim($('#meta-cliente-cpf').val()),
                email: safeTrim($('#meta-cliente-email').val()),
                telefone: safeTrim($('#meta-cliente-telefone').val())
            },
            endereco: {
                cep: safeTrim($('#meta-endereco-cep').val()),
                rua: safeTrim($('#meta-endereco-rua').val()),
                numero: safeTrim($('#meta-endereco-numero').val()),
                complemento: safeTrim($('#meta-endereco-complemento').val()),
                bairro: safeTrim($('#meta-endereco-bairro').val()),
                cidade: safeTrim($('#meta-endereco-cidade').val()),
                estado: safeTrim($('#meta-endereco-estado').val())
            },
            notas: recebimentoState.pedidos[pedidoEditando].meta?.notas || [],
            manifesto_numero: safeTrim($('#pedido-manifesto-numero').val()) || undefined
        };

        recebimentoState.pedidos[pedidoEditando].itens = itens;
        recebimentoState.pedidos[pedidoEditando].meta = meta;

        $('#modal-editar-pedido-recebimento').modal('hide');
        atualizarListaPedidosRecebimento();
        mostrarFeedback('Pedido atualizado com sucesso', 'success');

    } catch (error) {
        console.error('Erro ao salvar pedido:', error);
        mostrarFeedback(`Erro ao salvar pedido: ${error.message}`, 'error');
    }
}

// ========== FUNÇÃO PARA CONSTRUIR PAYLOAD ==========
function construirPayloadRecebimento() {
    const origemHubNome = safeTrim(document.getElementById('origem-hub-nome')?.value);
    const destinoHubNome = safeTrim(document.getElementById('destino-hub-nome')?.value);
    const operadorId = safeTrim(document.getElementById('operador-id')?.value);

    if (!origemHubNome || !destinoHubNome || !operadorId) {
        throw new Error('Origem, destino e operador são obrigatórios');
    }

    // Obter IDs dos hubs a partir dos inputs
    const origemInput = document.getElementById('origem-hub-nome');
    const destinoInput = document.getElementById('destino-hub-nome');
    const origemHubId = origemInput?.getAttribute('data-hub-id');
    const destinoHubId = destinoInput?.getAttribute('data-hub-id');

    // Processar manifestos com origem/destino
    const todosManifestos = [...recebimentoState.manifestos];
    const manifestoNumeros = new Set();

    recebimentoState.pedidos.forEach(pedido => {
        if (pedido.meta?.manifesto_numero) {
            manifestoNumeros.add(pedido.meta.manifesto_numero);
        }
    });

    manifestoNumeros.forEach(numeroManifesto => {
        const existeManifesto = todosManifestos.some(m => m.numero_manifesto === numeroManifesto);
        if (!existeManifesto) {
            todosManifestos.push({
                numero_manifesto: numeroManifesto,
                serie: '1',
                data_emissao: new Date().toISOString(),
                observacoes: `Manifesto automático para ${numeroManifesto}`,
                origem_hub_nome: origemHubNome,
                destino_hub_nome: destinoHubNome,
                origem_hub_id: origemHubId || null,
                destino_hub_id: destinoHubId || null,
                notas: []
            });
        }
    });

    // Normalizar manifestos com origem/destino
    const manifestosNormalizados = todosManifestos.map(manifesto => {
        const numeroManifesto = manifesto.numero_manifesto || `MAN-${Date.now()}`;

        // Se o manifesto não tiver origem/destino, usar os do recebimento
        const manifestoOrigemHubNome = manifesto.origem_hub_nome || origemHubNome;
        const manifestoDestinoHubNome = manifesto.destino_hub_nome || destinoHubNome;
        const manifestoOrigemHubId = manifesto.origem_hub_id || origemHubId;
        const manifestoDestinoHubId = manifesto.destino_hub_id || destinoHubId;

        let todasNotasDoManifesto = [...(manifesto.notas || [])];

        // Processar notas
        const notasNormalizadas = todasNotasDoManifesto.map(nota => {
            const itensNormalizados = (nota.itens || []).map(item => ({
                produto: {
                    nome: String(item.produto?.nome || ''),
                    descricao: item.produto?.descricao || null,
                    s_n: item.produto?.s_n || null,
                    p_n: item.produto?.p_n || null,
                    preco: parseFloat(item.produto?.preco) || 0,
                    peso_kg: parseFloat(item.produto?.peso_kg) || 0
                },
                quantidade: parseInt(item.quantidade) || 1,
                valor_unitario: parseFloat(item.valor_unitario) || 0,
                descricao: item.descricao || null
            }));
            return {
                numero: String(nota.numero || ''),
                serie: String(nota.serie || '1'),
                data_emissao: nota.data_emissao ? new Date(nota.data_emissao).toISOString() : new Date().toISOString(),
                itens: itensNormalizados
            };
        });

        return {
            numero_manifesto: numeroManifesto,
            serie: manifesto.serie || '1',
            data_emissao: manifesto.data_emissao || new Date().toISOString(),
            observacoes: manifesto.observacoes || null,
            origem_hub_nome: manifestoOrigemHubNome,
            destino_hub_nome: manifestoDestinoHubNome,
            origem_hub_id: manifestoOrigemHubId || null,
            destino_hub_id: manifestoDestinoHubId || null,
            notas: notasNormalizadas
        };
    });

    // Construir payload completo
    const payload = {
        numero_recebimento: safeTrim(document.getElementById('numero-recebimento')?.value) || null,
        operador_id: parseInt(operadorId),
        usuario_id: parseInt(operadorId),
        tipo_tarefa: safeTrim(document.getElementById('tipo-tarefa')?.value) || 'INBOUND',
        origem_hub_nome: origemHubNome,
        destino_hub_nome: destinoHubNome,
        origem_hub_id: origemHubId || null,
        destino_hub_id: destinoHubId || null,
        createMissingPedidos: document.getElementById('create-missing-pedidos')?.checked || false,
        recebimento: {
            numero_recebimento: safeTrim(document.getElementById('numero-recebimento')?.value) || null,
            observacoes: safeTrim(document.getElementById('observacoes')?.value) || null,
            localizacao: safeTrim(document.getElementById('localizacao')?.value) || null,
            numero_romaneio: safeTrim(document.getElementById('numero-romaneio')?.value) || null,
            // CORREÇÃO: Usar o estado de transporte do recebimentoState
            transporte: recebimentoState.transporte
        },
        manifestos: manifestosNormalizados,
        // CORREÇÃO: Usar o estado de pedidos do recebimentoState
        pedidosDados: recebimentoState.pedidos
    };

    return payload;
}

function mostrarPreviewRecebimento() {
    try {
        const errosValidacao = validarPedidosParaPayload();
        if (errosValidacao.length > 0) {
            const mensagemErro = errosValidacao.join('\n• ');
            mostrarFeedback(`Erros de validação:\n• ${mensagemErro}`, 'error');
            return;
        }

        const payload = construirPayloadRecebimento();
        const previewElement = document.getElementById('preview-json');
        const container = document.getElementById('preview-json-container');

        if (previewElement) {
            previewElement.textContent = JSON.stringify(payload, null, 2);
        }

        if (container) {
            container.style.display = 'block';
            container.scrollIntoView({ behavior: 'smooth' });
        }

        mostrarFeedback('Payload validado e construído com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao construir payload:', error);
        mostrarFeedback(`Erro ao construir payload: ${error.message}`, 'error');
    }
}

async function salvarRecebimentoCompleto(e) {
    if (e) e.preventDefault();

    try {
        mostrarCarregamento(true);

        const errosValidacao = validarPedidosParaPayload();
        if (errosValidacao.length > 0) {
            const mensagemErro = errosValidacao.join('\n• ');
            mostrarFeedback(`Erros de validação:\n• ${mensagemErro}`, 'error');
            mostrarCarregamento(false);
            return;
        }

        const payload = construirPayloadRecebimento();

        if (payload.manifestos && payload.manifestos.length > 0) {
            const manifestosValidos = verificarPayloadManifestos(payload);
            if (!manifestosValidos) {
                const confirmar = confirm('Os manifestos não possuem numero_manifesto válido. Deseja continuar mesmo assim?');
                if (!confirmar) {
                    mostrarCarregamento(false);
                    return;
                }
            }
        }

        console.log('Enviando payload:', payload);

        const response = await apiRequest('/recebimentos', 'POST', payload);

        mostrarFeedback('Recebimento criado com sucesso!', 'success');

        $('#modal-novo-recebimento').modal('hide');
        limparModalRecebimento();

        await carregarRecebimentos({}, 1);

    } catch (error) {
        console.error('Erro ao criar recebimento:', error);
        mostrarFeedback(`Erro ao criar recebimento: ${error.message}`, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

function limparModalRecebimento() {
    recebimentoState = {
        dadosGerais: {
            numero_recebimento: '',
            operador_id: '',
            usuario_id: '',
            tipo_tarefa: 'INBOUND',
            origem_hub_nome: '',
            destino_hub_nome: '',
            createMissingPedidos: true
        },
        transporte: {
            transportador_nome: '',
            cnpj_transportador: '',
            endereco_transportador: '',
            placa_veiculo: '',
            uf_veiculo: '',
            frete_por_conta: 'emitente',
            quantidade_volume: 0,
            especie_volumes: '',
            marca_volumes: '',
            numero_volumes: '',
            peso_bruto: 0,
            peso_liquido: 0,
            informacoes_transporte: ''
        },
        manifestos: [],
        pedidos: []
    };

    pedidoEditando = null;
    manifestoEditando = null;
    notaEditando = null;
    itemNotaEditando = null;

    const form = document.getElementById('form-novo-recebimento');
    if (form) {
        form.reset();
    }

    const listaPedidos = document.getElementById('lista-pedidos-recebimento');
    if (listaPedidos) {
        listaPedidos.innerHTML = '';
    }

    const listaManifestos = document.getElementById('lista-manifestos');
    if (listaManifestos) {
        listaManifestos.innerHTML = '';
    }

    const previewContainer = document.getElementById('preview-json-container');
    if (previewContainer) {
        previewContainer.style.display = 'none';
    }
}

// ========== FUNÇÕES DE INICIALIZAÇÃO ==========
function inicializarModalRecebimento() {
    console.log('Inicializando modal de recebimento...');

    // Botões principais
    const btnAdicionarPedido = document.getElementById('btn-adicionar-pedido');
    if (btnAdicionarPedido) {
        btnAdicionarPedido.addEventListener('click', adicionarPedidoRecebimento);
    }

    const btnAdicionarManifesto = document.getElementById('btn-adicionar-manifesto');
    if (btnAdicionarManifesto) {
        btnAdicionarManifesto.addEventListener('click', adicionarManifesto);
    }

    const btnPreviewJson = document.getElementById('btn-preview-json');
    if (btnPreviewJson) {
        btnPreviewJson.addEventListener('click', mostrarPreviewRecebimento);
    }

    // Botões de salvamento
    const btnSalvarPedido = document.getElementById('btn-salvar-pedido-edicao');
    if (btnSalvarPedido) {
        btnSalvarPedido.addEventListener('click', salvarPedidoEditado);
    }

    const btnAdicionarItem = document.getElementById('btn-adicionar-item-pedido');
    if (btnAdicionarItem) {
        btnAdicionarItem.addEventListener('click', function () {
            adicionarItemPedidoUI();
        });
    }

    const btnAdicionarNotaPedido = document.getElementById('btn-adicionar-nota-pedido');
    if (btnAdicionarNotaPedido) {
        btnAdicionarNotaPedido.addEventListener('click', function () {
            if (pedidoEditando !== null) {
                adicionarNota('pedido', pedidoEditando);
            } else {
                mostrarFeedback('Selecione um pedido para edição primeiro', 'error');
            }
        });
    }

    const btnAdicionarNotaManifesto = document.getElementById('btn-adicionar-nota-manifesto');
    if (btnAdicionarNotaManifesto) {
        btnAdicionarNotaManifesto.addEventListener('click', function () {
            if (manifestoEditando !== null) {
                adicionarNota('manifesto', manifestoEditando);
            } else {
                mostrarFeedback('Selecione um manifesto para edição primeiro', 'error');
            }
        });
    }

    const btnAdicionarItemNota = document.getElementById('btn-adicionar-item-nota');
    if (btnAdicionarItemNota) {
        btnAdicionarItemNota.addEventListener('click', function () {
            if (notaEditando) {
                const { contexto, indexPrincipal, indexNota } = notaEditando;
                adicionarItemNota(contexto, indexPrincipal, indexNota);
            } else {
                mostrarFeedback('Selecione uma nota fiscal para edição primeiro', 'error');
            }
        });
    }

    // Botões de salvamento de edição
    const btnSalvarManifesto = document.getElementById('btn-salvar-manifesto');
    if (btnSalvarManifesto) {
        btnSalvarManifesto.addEventListener('click', salvarManifesto);
    }

    const btnSalvarNota = document.getElementById('btn-salvar-nota');
    if (btnSalvarNota) {
        btnSalvarNota.addEventListener('click', salvarNota);
    }

    const btnSalvarItemNota = document.getElementById('btn-salvar-item-nota');
    if (btnSalvarItemNota) {
        btnSalvarItemNota.addEventListener('click', salvarItemNota);
    }

    // Formulário principal
    const formNovoRecebimento = document.getElementById('form-novo-recebimento');
    if (formNovoRecebimento) {
        formNovoRecebimento.addEventListener('submit', salvarRecebimentoCompleto);
    }

    // Inicializar autocomplete para hubs
    inicializarAutocompleteHub('origem-hub-nome', 'sugestoes-origem-hub');
    inicializarAutocompleteHub('destino-hub-nome', 'sugestoes-destino-hub');

    // Inicializar autocomplete para os campos de hub do manifesto (serão re-inicializados quando o modal abrir)
    inicializarAutocompleteHub('manifesto-origem-hub', 'sugestoes-manifesto-origem');
    inicializarAutocompleteHub('manifesto-destino-hub', 'sugestoes-manifesto-destino');

    // Inicializar estado
    preencherEstadoTransporte();
    inicializarEventListenersEstado();

    // Configurar eventos de clique nos manifestos
    const listaManifestos = document.getElementById('lista-manifestos');
    if (listaManifestos) {
        listaManifestos.addEventListener('click', function (e) {
            const target = e.target;
            const btnEditar = target.closest('.btn-editar-manifesto');
            const btnRemover = target.closest('.btn-remover-manifesto');

            if (btnEditar) {
                const index = parseInt(btnEditar.dataset.index);
                abrirModalEditarManifesto(index);
            }

            if (btnRemover) {
                const index = parseInt(btnRemover.dataset.index);
                if (confirm('Deseja remover este manifesto?')) {
                    recebimentoState.manifestos.splice(index, 1);
                    atualizarListaManifestos();
                    mostrarFeedback('Manifesto removido', 'success');
                }
            }
        });
    }

    // Configurar eventos de clique nas notas do manifesto
    const listaNotasManifesto = document.getElementById('lista-notas-manifesto');
    if (listaNotasManifesto) {
        listaNotasManifesto.addEventListener('click', function (e) {
            const target = e.target;
            const btnEditar = target.closest('.btn-editar-nota-manifesto');
            const btnRemover = target.closest('.btn-remover-nota-manifesto');

            if (btnEditar && manifestoEditando !== null) {
                const indexNota = parseInt(btnEditar.dataset.notaIndex);
                abrirModalEditarNota('manifesto', manifestoEditando, indexNota);
            }

            if (btnRemover && manifestoEditando !== null) {
                const indexNota = parseInt(btnRemover.dataset.notaIndex);
                if (confirm('Deseja remover esta nota fiscal?')) {
                    recebimentoState.manifestos[manifestoEditando].notas.splice(indexNota, 1);
                    atualizarListaNotasManifesto(manifestoEditando);
                    mostrarFeedback('Nota fiscal removida', 'success');
                }
            }
        });
    }

    // Configurar eventos de clique nos itens da nota
    const listaItensNota = document.getElementById('lista-itens-nota');
    if (listaItensNota) {
        listaItensNota.addEventListener('click', function (e) {
            const target = e.target;
            const btnEditar = target.closest('.btn-editar-item-nota');
            const btnRemover = target.closest('.btn-remover-item-nota');

            if (btnEditar && notaEditando) {
                const indexItem = parseInt(btnEditar.dataset.itemIndex);
                const { contexto, indexPrincipal, indexNota } = notaEditando;
                abrirModalEditarItemNota(contexto, indexPrincipal, indexNota, indexItem);
            }

            if (btnRemover && notaEditando) {
                const indexItem = parseInt(btnRemover.dataset.itemIndex);
                if (confirm('Deseja remover este item?')) {
                    const { contexto, indexPrincipal, indexNota } = notaEditando;
                    if (contexto === 'manifesto') {
                        recebimentoState.manifestos[indexPrincipal].notas[indexNota].itens.splice(indexItem, 1);
                    } else if (contexto === 'pedido') {
                        recebimentoState.pedidos[indexPrincipal].meta.notas[indexNota].itens.splice(indexItem, 1);
                    }
                    atualizarListaItensNota(contexto, indexPrincipal, indexNota);
                    mostrarFeedback('Item removido', 'success');
                }
            }
        });
    }

    // Configurar eventos de clique nos pedidos do recebimento
    const listaPedidosRecebimento = document.getElementById('lista-pedidos-recebimento');
    if (listaPedidosRecebimento) {
        listaPedidosRecebimento.addEventListener('click', function (e) {
            const target = e.target;
            const btnEditar = target.closest('.btn-editar-pedido');
            const btnRemover = target.closest('.btn-remover-pedido');

            if (btnEditar) {
                const index = parseInt(btnEditar.dataset.index);
                abrirModalEditarPedidoRecebimento(index);
            }

            if (btnRemover) {
                const index = parseInt(btnRemover.dataset.index);
                if (confirm('Deseja remover este pedido do recebimento?')) {
                    recebimentoState.pedidos.splice(index, 1);
                    atualizarListaPedidosRecebimento();
                    mostrarFeedback('Pedido removido', 'success');
                }
            }
        });
    }

    // Configurar eventos de clique nas notas do pedido
    const listaNotasPedido = document.getElementById('lista-notas-pedido');
    if (listaNotasPedido) {
        listaNotasPedido.addEventListener('click', function (e) {
            const target = e.target;
            const btnEditar = target.closest('.btn-editar-nota-pedido');
            const btnRemover = target.closest('.btn-remover-nota-pedido');

            if (btnEditar && pedidoEditando !== null) {
                const indexNota = parseInt(btnEditar.dataset.notaIndex);
                abrirModalEditarNota('pedido', pedidoEditando, indexNota);
            }

            if (btnRemover && pedidoEditando !== null) {
                const indexNota = parseInt(btnRemover.dataset.notaIndex);
                if (confirm('Deseja remover esta nota fiscal do pedido?')) {
                    recebimentoState.pedidos[pedidoEditando].meta.notas.splice(indexNota, 1);
                    atualizarListaNotasPedido(pedidoEditando);
                    mostrarFeedback('Nota fiscal removida', 'success');
                }
            }
        });
    }

    // Botão para adicionar pedido na nota
    const btnAdicionarPedidoNota = document.getElementById('btn-adicionar-pedido-nota');
    if (btnAdicionarPedidoNota) {
        btnAdicionarPedidoNota.addEventListener('click', adicionarPedidoNaNota);
    }

    // Inicializar datalist de operadores
    const operadorInput = document.getElementById('operador-id');
    if (operadorInput) {
        const datalist = document.getElementById('lista-operadores');
        if (datalist) {
            // Limpar e popular com operadores atuais
            datalist.innerHTML = '';
            const operadores = Array.from(operadoresSet).sort();
            operadores.forEach(op => {
                const option = document.createElement('option');
                option.value = op;
                datalist.appendChild(option);
            });
        }
    }

    // Configurar limpeza do modal ao fechar
    $('#modal-novo-recebimento').on('hidden.bs.modal', function () {
        limparModalRecebimento();
    });

    console.log('Modal de recebimento inicializado com sucesso');
}

function inicializarEventListenersEstado() {
    const camposGerais = [
        'numero-recebimento', 'operador-id', 'tipo-tarefa',
        'origem-hub-nome', 'destino-hub-nome'
    ];

    camposGerais.forEach(campo => {
        const element = document.getElementById(campo);
        if (element) {
            const fieldName = campo.replace(/-/g, '_');

            if (fieldName in recebimentoState.dadosGerais) {
                recebimentoState.dadosGerais[fieldName] = safeTrim(element.value);
            }

            element.addEventListener('change', function () {
                if (fieldName in recebimentoState.dadosGerais) {
                    recebimentoState.dadosGerais[fieldName] = safeTrim(this.value);
                }
            });

            element.addEventListener('input', function () {
                if (fieldName in recebimentoState.dadosGerais) {
                    recebimentoState.dadosGerais[fieldName] = safeTrim(this.value);
                }
            });
        }
    });

    const createMissingCheckbox = document.getElementById('create-missing-pedidos');
    if (createMissingCheckbox) {
        createMissingCheckbox.addEventListener('change', function () {
            recebimentoState.dadosGerais.createMissingPedidos = this.checked;
        });
    }
}

function validarPedidosParaPayload() {
    const erros = [];

    if (recebimentoState.pedidos.length === 0) {
        erros.push('Adicione pelo menos um pedido');
    }

    recebimentoState.pedidos.forEach((pedido, index) => {
        const temItensDiretos = pedido.itens && pedido.itens.length > 0;
        const temItensNotas = pedido.meta?.notas?.some(nota => nota.itens && nota.itens.length > 0);

        if (!temItensDiretos && !temItensNotas) {
            erros.push(`Pedido ${pedido.codigo} não possui itens (nem diretos nem em notas fiscais)`);
        }

        if (!pedido.meta?.cliente?.nome) {
            erros.push(`Pedido ${pedido.codigo} não possui nome do cliente`);
        }

        if (temItensDiretos) {
            pedido.itens.forEach((item, itemIndex) => {
                if (!item.produto?.nome) {
                    erros.push(`Item ${itemIndex + 1} do pedido ${pedido.codigo} não possui nome do produto`);
                }
                if (!item.quantidade || item.quantidade < 1) {
                    erros.push(`Item ${itemIndex + 1} do pedido ${pedido.codigo} possui quantidade inválida`);
                }
                if (!item.valor_unitario || item.valor_unitario < 0) {
                    erros.push(`Item ${itemIndex + 1} do pedido ${pedido.codigo} possui valor unitário inválido`);
                }
            });
        }

        if (temItensNotas) {
            pedido.meta.notas.forEach((nota, notaIndex) => {
                if (nota.itens) {
                    nota.itens.forEach((item, itemIndex) => {
                        if (!item.produto?.nome) {
                            erros.push(`Item ${itemIndex + 1} da nota ${notaIndex + 1} do pedido ${pedido.codigo} não possui nome do produto`);
                        }
                        if (!item.quantidade || item.quantidade < 1) {
                            erros.push(`Item ${itemIndex + 1} da nota ${notaIndex + 1} do pedido ${pedido.codigo} possui quantidade inválida`);
                        }
                        if (!item.valor_unitario || item.valor_unitario < 0) {
                            erros.push(`Item ${itemIndex + 1} da nota ${notaIndex + 1} do pedido ${pedido.codigo} possui valor unitário inválido`);
                        }
                    });
                }
            });
        }
    });

    return erros;
}

function preencherEstadoTransporte() {
    const camposTransporte = [
        'transporte-transportador-nome', 'transporte-cnpj-transportador',
        'transporte-endereco-transportador', 'transporte-placa-veiculo',
        'transporte-uf-veiculo', 'transporte-frete-por-conta',
        'transporte-quantidade-volume', 'transporte-especie-volumes',
        'transporte-marca-volumes', 'transporte-numero-volumes',
        'transporte-peso-bruto', 'transporte-peso-liquido', 'transporte-informacoes'
    ];

    camposTransporte.forEach(campo => {
        const element = document.getElementById(campo);
        if (element) {
            const fieldName = campo.replace('transporte-', '');
            recebimentoState.transporte[fieldName] = safeTrim(element.value);

            element.addEventListener('change', function () {
                recebimentoState.transporte[fieldName] = safeTrim(this.value);
            });

            element.addEventListener('input', function () {
                recebimentoState.transporte[fieldName] = safeTrim(this.value);
            });
        }
    });
}

// Carregar dados para os selects do recebimento
async function carregarDadosRecebimento() {
    try {
        const operadores = Array.from(operadoresSet);
        const datalist = document.getElementById('lista-operadores');
        if (datalist) {
            datalist.innerHTML = '';
            operadores.forEach(op => {
                const option = document.createElement('option');
                option.value = op;
                datalist.appendChild(option);
            });
        }

    } catch (error) {
        console.error('Erro ao carregar dados do recebimento:', error);
        mostrarFeedback('Erro ao carregar lista de operadores', 'error');
    }
}

// ---------- Conference Functions ----------
async function carregarConferencias(filtros = {}, page = 1, limit = PAGE_SIZE) {
    try {
        mostrarCarregamento(true);

        const queryParams = {
            page,
            limit,
            ...filtros
        };

        const data = await apiRequest('/conferencias', 'GET', null, queryParams);

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
            tbody.innerHTML = '<tr><td colspan="13" class="text-center text-danger">Erro ao carregar dados</td></tr>';
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
        tbody.innerHTML = '<tr><td colspan="14" class="text-center">Nenhuma conferência encontrada</td></tr>';
        renderPaginationConferencias();
        return;
    }

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
                    ${c.manifesto_id ? `
                        <button class="btn btn-sm btn-secondary btn-view-manifesto" data-manifesto-id="${c.manifesto_id}" title="Visualizar Manifesto">
                            <i class="fas fa-file-alt"></i>
                        </button>
                    `: ''}
                    
                    <!-- Botão para visualizar romaneio da conferência (sempre visível se houver transporte) -->
                    ${c.transporte_id ? `
                        <button class="btn btn-sm btn-primary btn-view-romaneio-conferencia" data-id="${c.id}" title="Visualizar Romaneio">
                            <i class="fas fa-truck-loading"></i>
                        </button>
                    `: ''}
                    
                    <!-- Botão para gerar romaneio da conferência -->
                    ${c.status !== 'CONCLUIDO' && c.transporte_id ? `
                        <button class="btn btn-sm btn-outline-info btn-generate-romaneio-conferencia" data-id="${c.id}" title="Gerar Romaneio">
                            <i class="fas fa-file-export"></i>
                        </button>
                    `: ''}
                    
                    ${c.status !== 'CONCLUIDO' ? `
                    <button class="btn btn-sm btn-primary btn-edit-conf" data-id="${c.id}" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-success btn-concluir-conf" data-id="${c.id}" title="Concluir"><i class="fas fa-check"></i></button>
                     <button class="btn btn-sm btn-outline-secondary btn-generate-manifesto" data-id="${c.id}" data-tipo="conferencia" title="Gerar Manifesto">
                            <i class="fas fa-plus"></i>
                    </button>
                    ` : ''}

                    
                    <button class="btn btn-sm btn-danger btn-delete-conf" data-id="${c.id}" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    renderPaginationConferencias();

    // Configurar eventos para os novos botões
    tbody.querySelectorAll('.btn-view-manifesto').forEach(btn => {
        btn.addEventListener('click', function () {
            visualizarManifesto(this.dataset.manifestoId);
        });
    });

    tbody.querySelectorAll('.btn-generate-manifesto').forEach(btn => {
        btn.addEventListener('click', function () {
            gerarManifesto(this.dataset.id, this.dataset.tipo);
        });
    });

    // Evento para visualizar romaneio da conferência
    tbody.querySelectorAll('.btn-view-romaneio-conferencia').forEach(btn => {
        btn.addEventListener('click', function () {
            visualizarRomaneioConferencia(this.dataset.id);
        });
    });

    // Evento para gerar romaneio da conferência
    tbody.querySelectorAll('.btn-generate-romaneio-conferencia').forEach(btn => {
        btn.addEventListener('click', function () {
            gerarRomaneioConferencia(this.dataset.id);
        });
    });
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
        const response = await apiRequest(`/conferencias/${id}/concluir`, 'POST');
        mostrarFeedback('Conferência concluída com sucesso!', 'success');

        if (response.manifesto) {
            mostrarFeedback(`Manifesto ${response.manifesto.numero_manifesto} criado com ${response.manifesto.quantidade_notas} notas`, 'success');
            setTimeout(() => {
                visualizarManifesto(response.manifesto.id);
            }, 1500);
        }

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
        tbody.innerHTML = '<tr><td colspan="11" class="text-center">Nenhum recebimento encontrado</td></tr>';
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
                    ${r.manifesto_id ? `
                        <button class="btn btn-sm btn-secondary btn-view-manifesto" data-manifesto-id="${r.manifesto_id}" title="Visualizar MDF-e">
                            <i class="fas fa-file-alt"></i>
                        </button>
                        <button class="btn btn-sm btn-info btn-view-romaneio" data-recebimento-id="${r.id}" title="Visualizar Romaneio">
                            <i class="fas fa-truck-loading"></i>
                        </button>
                    ` : r.status !== 'CONCLUIDO' ? `
                        <button class="btn btn-sm btn-outline-secondary btn-generate-manifesto" data-id="${r.id}" data-tipo="recebimento" title="Gerar Manifesto">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-info btn-generate-romaneio" data-id="${r.id}" data-tipo="recebimento" title="Gerar Romaneio">
                            <i class="fas fa-file-export"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-danger btn-delete-rec" data-id="${r.id}" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    renderPaginationRecebimentos();

    tbody.querySelectorAll('.btn-view-manifesto').forEach(btn => {
        btn.addEventListener('click', function () {
            visualizarManifesto(this.dataset.manifestoId);
        });
    });

    tbody.querySelectorAll('.btn-generate-manifesto').forEach(btn => {
        btn.addEventListener('click', function () {
            gerarManifesto(this.dataset.id, this.dataset.tipo);
        });
    });

    tbody.querySelectorAll('.btn-view-romaneio').forEach(btn => {
        btn.addEventListener('click', function () {
            visualizarRomaneio(this.dataset.recebimentoId);
        });
    });

    tbody.querySelectorAll('.btn-generate-romaneio').forEach(btn => {
        btn.addEventListener('click', function () {
            gerarRomaneio(this.dataset.id, this.dataset.tipo);
        });
    });
}

function inicializarEventosRecebimentos() {
    document.querySelectorAll('.btn-view-rec').forEach(btn => {
        btn.addEventListener('click', () => abrirModalDetalhesRecebimento(btn.dataset.id));
    });

    document.querySelectorAll('.btn-edit-rec').forEach(btn => {
        btn.addEventListener('click', () => abrirModalEditarRecebimento(btn.dataset.id));
    });
}

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

async function concluirRecebimento(id) {
    if (!confirm('Deseja concluir este recebimento?')) return;
    try {
        mostrarCarregamento(true);
        const response = await apiRequest(`/recebimentos/${id}/concluir`, 'POST');
        mostrarFeedback('Recebimento concluído com sucesso!', 'success');

        if (response.manifesto) {
            mostrarFeedback(`Manifesto ${response.manifesto.numero_manifesto} criado com ${response.manifesto.quantidade_notas} notas`, 'success');
            setTimeout(() => {
                visualizarManifesto(response.manifesto.id);
            }, 1500);
        }

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
        tipo: document.getElementById('filtro-tipo-conf')?.value,
        status: document.getElementById('filtro-status-conf')?.value,
        operador_id: document.getElementById('filtro-operador-conf')?.value,
        data: document.getElementById('filtro-data-conf')?.value
    };

    Object.keys(filtros).forEach(key => {
        if (!filtros[key]) delete filtros[key];
    });

    filtrosAtuaisConferencias = filtros;
    modoBuscaConferencias = false;
    termoBuscaConferencias = '';

    await carregarConferencias(filtros, 1);
}

async function buscarConferencias() {
    const query = document.getElementById('filtro-busca-conf')?.value;
    if (!query) {
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

    carregarConferencias();
    carregarRecebimentos();
    carregarHubs();

    configurarEventos();
    inicializarModalRecebimento();
});

function configurarEventos() {
    // Eventos existentes para conferências...
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

    // Eventos existentes para recebimentos...
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

        if (e.target.closest('.btn-view-romaneio')) {
            const recebimentoId = e.target.closest('.btn-view-romaneio').dataset.recebimentoId;
            visualizarRomaneio(recebimentoId);
        }

        if (e.target.closest('.btn-generate-romaneio')) {
            const id = e.target.closest('.btn-generate-romaneio').dataset.id;
            const tipo = e.target.closest('.btn-generate-romaneio').dataset.tipo;
            gerarRomaneio(id, tipo);
        }
    });

    async function visualizarRomaneio(recursoId, tipo = 'recebimento') {
        try {
            if (tipo === 'recebimento') {
                // Código existente para recebimentos...
                const recebimento = await apiRequest(`/recebimentos/${recursoId}`, 'GET');
                const pedidos = await apiRequest(`/recebimentos/${recursoId}/pedidos`, 'GET');

                const origemHub = recebimento.origem_hub_id ? await apiRequest(`/hubs/${recebimento.origem_hub_id}`, 'GET') : null;
                const destinoHub = recebimento.destino_hub_id ? await apiRequest(`/hubs/${recebimento.destino_hub_id}`, 'GET') : null;

                const baseUrl = API_BASE_URL.replace(/\/$/, '');
                const romaneioUrl = `${baseUrl}/romaneio.html`;
                const targetOrigin = new URL(baseUrl).origin;

                const janela = window.open(romaneioUrl, '_blank');

                if (!janela) {
                    mostrarFeedback('Não foi possível abrir a janela do romaneio. Verifique se os pop-ups estão bloqueados.', 'error');
                    return;
                }

                const dadosRomaneio = {
                    tipo: 'romaneio:load',
                    dadosRomaneio: {
                        recebimento: recebimento,
                        pedidos: pedidos,
                        origemHub: origemHub,
                        destinoHub: destinoHub
                    }
                };

                let tentativas = 0;
                const maxTentativas = 5;

                const tentarEnviarDados = () => {
                    try {
                        janela.postMessage(dadosRomaneio, targetOrigin);
                        console.log('Dados do romaneio enviados com sucesso');
                    } catch (e) {
                        tentativas++;
                        if (tentativas < maxTentativas) {
                            setTimeout(tentarEnviarDados, 300);
                        } else {
                            console.error('Falha ao enviar dados para o romaneio após', maxTentativas, 'tentativas');
                            mostrarFeedback('Erro ao carregar dados do romaneio', 'error');
                        }
                    }
                };

                setTimeout(tentarEnviarDados, 500);

            } else if (tipo === 'conferencia') {
                // Usar a nova função para conferências
                await visualizarRomaneioConferencia(recursoId);
            }
        } catch (error) {
            console.error('Erro ao visualizar romaneio:', error);
            mostrarFeedback('Erro ao visualizar romaneio: ' + error.message, 'error');
        }
    }


    // Eventos do scanner...
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

    // Eventos dos formulários...
    const formNovaConferencia = document.getElementById('form-nova-conferencia');
    const formNovoRecebimento = document.getElementById('form-novo-recebimento');

    if (formNovaConferencia) {
        formNovaConferencia.addEventListener('submit', salvarConferencia);
    }

    if (formNovoRecebimento) {
        formNovoRecebimento.addEventListener('submit', salvarRecebimentoCompleto);
    }

    // Eventos para adicionar pedidos...
    const btnAddPedidoConferencia = document.getElementById('btn-add-pedido-conferencia');
    const btnAddPedidoRecebimento = document.getElementById('btn-add-pedido-recebimento');

    if (btnAddPedidoConferencia) {
        btnAddPedidoConferencia.addEventListener('click', adicionarPedidoConferencia);
    }

    if (btnAddPedidoRecebimento) {
        btnAddPedidoRecebimento.addEventListener('click', adicionarPedidoRecebimento);
    }

    // Eventos de tipo de conferência...
    const tipoSelect = document.getElementById('nova-conferencia-tipo');
    const campotransporte = document.getElementById('campo-numero-transporte');

    if (tipoSelect && campotransporte) {
        tipoSelect.addEventListener('change', function () {
            campotransporte.style.display = this.value === 'OUTBOUND' ? 'block' : 'none';
            if (this.value === 'OUTBOUND') {
                document.getElementById('nova-conferencia-numero-transporte').setAttribute('required', 'required');
            } else {
                document.getElementById('nova-conferencia-numero-transporte').removeAttribute('required');
            }
        });
    }

    // Eventos de filtros e busca...
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
    limparModalRecebimento();
    carregarDadosRecebimento();
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

function limparFormularioConferencia() {
    const form = document.getElementById('form-nova-conferencia');
    if (form) {
        form.reset();

        const operadorSelect = document.getElementById('nova-conferencia-operador');
        if (operadorSelect) operadorSelect.selectedIndex = 0;

        const tipoSelect = document.getElementById('nova-conferencia-tipo');
        if (tipoSelect) tipoSelect.selectedIndex = 0;

        const estacaoSelect = document.getElementById('nova-conferencia-estacao');
        if (estacaoSelect) estacaoSelect.selectedIndex = 0;

        const transporteInput = document.getElementById('nova-conferencia-numero-transporte');
        if (transporteInput) transporteInput.value = '';

        const listaPedidos = document.getElementById('lista-pedidos-conf');
        if (listaPedidos) listaPedidos.innerHTML = '';

        const contadorPedidos = document.getElementById('contador-pedidos-conf');
        if (contadorPedidos) contadorPedidos.textContent = '0';
    }
}

function limparFormularioRecebimento() {
    const form = document.getElementById('form-novo-recebimento');
    if (form) {
        form.reset();

        const operadorSelect = document.getElementById('novo-recebimento-operador');
        if (operadorSelect) operadorSelect.selectedIndex = 0;

        const metodoSelect = document.getElementById('novo-recebimento-metodo');
        if (metodoSelect) metodoSelect.selectedIndex = 0;

        const manifestoInput = document.getElementById('novo-recebimento-manifesto');
        if (manifestoInput) manifestoInput.value = '';

        const origemInput = document.getElementById('novo-recebimento-origem-hub');
        if (origemInput) {
            origemInput.value = '';
            origemInput.removeAttribute('data-hub-id');
        }

        const destinoInput = document.getElementById('novo-recebimento-destino-hub');
        if (destinoInput) {
            destinoInput.value = '';
            destinoInput.removeAttribute('data-hub-id');
        }

        const enderecoTextarea = document.getElementById('novo-recebimento-endereco');
        if (enderecoTextarea) enderecoTextarea.value = '';

        const listaPedidos = document.getElementById('lista-pedidos-rec');
        if (listaPedidos) listaPedidos.innerHTML = '';

        const contadorPedidos = document.getElementById('contador-pedidos-rec');
        if (contadorPedidos) contadorPedidos.textContent = '0';
    }
}

async function abrirModalEditarConferencia(id) {
    try {
        mostrarCarregamento(true);

        const conferencia = await apiRequest(`/conferencias/${id}`, 'GET');

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

                const contador = document.getElementById('contador-pedidos-editar-conferencia');
                if (contador) contador.textContent = pedidos.length;
            } else {
                listaPedidos.innerHTML = '<li class="list-group-item text-center">Nenhum pedido encontrado</li>';
            }
        }

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

        const recebimento = await apiRequest(`/recebimentos/${id}`, 'GET');
        const pedidos = await apiRequest(`/recebimentos/${id}/pedidos`, 'GET');

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

        const status = STATUS[recebimento.status] || { class: '', text: recebimento.status || '-' };
        const statusBadge = document.getElementById('detalhe-status-rec');
        if (statusBadge) {
            statusBadge.className = `badge ${status.class}`;
            statusBadge.textContent = status.text;
        }

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

        const btnConcluir = document.getElementById('btn-concluir-rec');
        if (btnConcluir) {
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

        const btnRomaneio = document.getElementById('btn-visualizar-romaneio-rec');
        if (btnRomaneio) {
            const newBtnRomaneio = btnRomaneio.cloneNode(true);
            btnRomaneio.parentNode.replaceChild(newBtnRomaneio, btnRomaneio);

            if (recebimento.manifesto_id) {
                newBtnRomaneio.style.display = 'inline-block';
                newBtnRomaneio.addEventListener('click', () => {
                    visualizarRomaneio(recebimento.id);
                });
            } else {
                newBtnRomaneio.style.display = 'none';
            }
        }

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

        const recebimento = await apiRequest(`/recebimentos/${id}`, 'GET');
        const pedidos = await apiRequest(`/recebimentos/${id}/pedidos`, 'GET');

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

                const contador = document.getElementById('contador-pedidos-editar-recebimento');
                if (contador) contador.textContent = pedidos.length;
            } else {
                listaPedidos.innerHTML = '<li class="list-group-item text-center">Nenhum pedido encontrado</li>';
            }
        }

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

async function adicionarPedidoConferencia() {
    const input = document.getElementById('input-codigo-pedido-conf');
    if (!input || !input.value) return;

    const codigo = safeTrim(input.value);
    if (!codigo) return;

    if (!await validarPedidoExistente(codigo)) {
        mostrarFeedback(`Pedido ${codigo} não encontrado no sistema`, 'error');
        return;
    }

    const lista = document.getElementById('lista-pedidos-conf');
    const contador = document.getElementById('contador-pedidos-conf');
    const quantidadeInput = document.getElementById('nova-conferencia-quantidade');

    if (lista && contador && quantidadeInput) {
        const pedidosExistentes = Array.from(lista.querySelectorAll('.pedido-item'))
            .map(item => item.textContent.split(' - ')[0].trim());

        if (pedidosExistentes.includes(codigo)) {
            mostrarFeedback('Pedido já adicionado à lista', 'warning');
            return;
        }

        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center pedido-item';
        li.innerHTML = `
            ${codigo} - A ser validado
            <button type="button" class="btn btn-sm btn-danger btn-remover-pedido">
                <i class="fas fa-times"></i>
            </button>
        `;

        lista.appendChild(li);

        const total = parseInt(contador.textContent) + 1;
        contador.textContent = total;
        quantidadeInput.value = total;

        const btnRemover = li.querySelector('.btn-remover-pedido');
        if (btnRemover) {
            btnRemover.addEventListener('click', function () {
                li.remove();
                const novoTotal = parseInt(contador.textContent) - 1;
                contador.textContent = novoTotal;
                quantidadeInput.value = novoTotal;
            });
        }

        input.value = '';
        input.focus();

        mostrarFeedback('Pedido adicionado à lista', 'success');
    }
}

async function salvarConferencia(e) {
    e.preventDefault();

    const form = e.target;
    const isEdit = form.id === 'form-editar-conferencia';
    const id = isEdit ? document.getElementById('editar-conferencia-id').value : null;

    try {
        mostrarCarregamento(true);

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

        if (formData.tipo === 'OUTBOUND') {
            formData.transporte_id = form.querySelector('#editar-conferencia-transporte') ?
                form.querySelector('#editar-conferencia-transporte').value :
                form.querySelector('#nova-conferencia-numero-transporte').value;
        }

        const listaPedidos = document.getElementById(isEdit ?
            'lista-pedidos-editar-conferencia' : 'lista-pedidos-conf');

        if (listaPedidos) {
            const pedidos = Array.from(listaPedidos.querySelectorAll('.pedido-item'))
                .map(item => item.textContent.split(' - ')[0].trim());

            formData.pedidos = pedidos;
        }

        const endpoint = isEdit ? `/conferencias/${id}` : '/conferencias';
        const method = isEdit ? 'PUT' : 'POST';

        await apiRequest(endpoint, method, formData);

        mostrarFeedback(`Conferência ${isEdit ? 'atualizada' : 'criada'} com sucesso!`, 'success');

        const modalElement = document.getElementById(isEdit ?
            'modal-editar-conferencia' : 'modal-nova-conferencia');

        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
        }

        await carregarConferencias(filtrosAtuaisConferencias, conferenciasCurrentPage);

    } catch (error) {
        console.error(`Erro ao ${isEdit ? 'editar' : 'criar'} conferência:`, error);

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

/**
 * Converte uma string de data/hora ou objeto Date para o formato YYYY-MM-DDTHH:MM,
 * adequado para inputs HTML do tipo datetime-local (e.g., para data_emissao).
 * @param {string | Date} dataString - A data a ser formatada.
 * @returns {string} A data formatada.
 */
function formatarDataParaInput(dataString) {
    if (!dataString) return '';

    const d = dataString instanceof Date ? dataString : new Date(dataString);

    if (isNaN(d.getTime())) return '';

    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');

    const horas = String(d.getHours()).padStart(2, '0');
    const minutos = String(d.getMinutes()).padStart(2, '0');

    return `${ano}-${mes}-${dia}T${horas}:${minutos}`;
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

// ---------- Funções de Manifesto (MDF-e) ----------
async function visualizarManifesto(manifestoId) {
    try {
        const manifestoData = await apiRequest(`/manifestos/${manifestoId}`, 'GET');

        const baseUrl = API_BASE_URL.replace(/\/$/, '');
        const mdfeUrl = `${baseUrl}/mdf-e.html`;
        const targetOrigin = new URL(baseUrl).origin;

        const janela = window.open(mdfeUrl, '_blank');

        if (!janela) {
            mostrarFeedback('Não foi possível abrir a janela do manifesto. Verifique se os pop-ups estão bloqueados.', 'error');
            return;
        }

        const dadosManifesto = {
            tipo: 'manifesto:load',
            dadosManifesto: {
                manifesto: manifestoData.manifesto || manifestoData,
                notas: manifestoData.notas || [],
                pedidos: manifestoData.pedidos || []
            }
        };

        let tentativas = 0;
        const maxTentativas = 5;

        const tentarEnviarDados = () => {
            try {
                janela.postMessage(dadosManifesto, targetOrigin);
                console.log('Dados do manifesto enviados com sucesso');
            } catch (e) {
                tentativas++;
                if (tentativas < maxTentativas) {
                    setTimeout(tentarEnviarDados, 300);
                } else {
                    console.error('Falha ao enviar dados para o manifesto após', maxTentativas, 'tentativas');
                    mostrarFeedback('Erro ao carregar dados do manifesto', 'error');
                }
            }
        };

        setTimeout(tentarEnviarDados, 500);

    } catch (error) {
        console.error('Erro ao visualizar manifesto:', error);
        mostrarFeedback('Erro ao visualizar manifesto: ' + error.message, 'error');
    }
}

// ---------- Funções de Romaneio ----------

/**
 * Visualiza o romaneio de uma conferência
 * @param {number} conferenciaId - ID da conferência
 */
async function visualizarRomaneioConferencia(conferenciaId) {
    try {
        // Buscar dados completos da conferência
        const conferencia = await apiRequest(`/conferencias/${conferenciaId}`, 'GET');

        // Buscar pedidos da conferência
        const pedidosApi = await apiRequest(`/conferencias/${conferenciaId}/pedidos`, 'GET');

        // Processar pedidos para o formato esperado pelo romaneio
        const pedidosProcessados = [];

        // Processar cada pedido individualmente
        for (const pedido of pedidosApi) {
            // Buscar dados completos do pedido
            const pedidoCompleto = await apiRequest(`/pedidos/${pedido.id}`, 'GET');

            // Buscar itens do pedido
            const itensPedido = pedidoCompleto.itens || [];

            // Buscar notas do pedido (se houver)
            let notasPedido = [];
            if (pedidoCompleto.manifesto_id) {
                // Buscar notas do manifesto
                const manifesto = await apiRequest(`/manifestos/${pedidoCompleto.manifesto_id}`, 'GET');
                notasPedido = manifesto.nota || [];
            }

            // Buscar cliente
            const cliente = pedidoCompleto.clientes || {};

            // Buscar endereço
            const endereco = pedidoCompleto.enderecos || {};

            // Calcular valor total do pedido
            const valorTotal = itensPedido.reduce((total, item) => {
                return total + (item.quantidade * item.valor_unitario);
            }, 0);

            // Calcular volumes (soma das quantidades)
            const volumes = itensPedido.reduce((total, item) => {
                return total + item.quantidade;
            }, 0);

            pedidosProcessados.push({
                id: pedido.id,
                codigo_pedido: pedido.codigo_pedido || pedido.id,
                quantidade: pedido.quantidade || volumes,
                status: pedido.status,
                cliente: cliente,
                endereco: endereco,
                itens: itensPedido,
                nota: notasPedido.filter(nota => nota.pedido_id === pedido.id),
                valor_total: valorTotal,
                volumes: volumes
            });
        }

        // Preparar dados para o romaneio
        const dadosRomaneio = {
            tipo: 'romaneio:load',
            dadosRomaneio: {
                // Usar a conferência como "recebimento" para o romaneio
                recebimento: {
                    id: conferencia.id,
                    numero_recebimento: `CONF-${conferencia.id}`,
                    status: conferencia.status,
                    data_criacao: conferencia.data_criacao,
                    quantidade_pedidos: conferencia.total_pedidos_iniciais || pedidosProcessados.length,
                    operador_id: conferencia.operador_id,
                    numero_manifesto: conferencia.manifesto?.numero_manifesto || null,
                    // Informações do transporte (da conferência)
                    transporte: conferencia.Transporte ? {
                        nome_transportador: conferencia.Transporte.nome_transportador,
                        cnpj_transportador: conferencia.Transporte.cnpj_transportador,
                        placa_veiculo: conferencia.Transporte.placa_veiculo,
                        uf_veiculo: conferencia.Transporte.uf_veiculo,
                        quantidade_volume: conferencia.Transporte.quantidade_volume,
                        peso_bruto: conferencia.Transporte.peso_bruto,
                        peso_liquido: conferencia.Transporte.peso_liquido,
                        numero_transporte: conferencia.Transporte.numero_transporte,
                        tipo_transporte: conferencia.Transporte.tipo_transporte,
                        direcao: conferencia.Transporte.direcao,
                        informacoes_transporte: conferencia.Transporte.informacoes_transporte
                    } : null,
                    // Informações da estação
                    nome_estacao: conferencia.nome_estacao,
                    // Usuário/operador
                    Usuario: conferencia.operador || {
                        nome: conferencia.operador?.nome || 'Operador não identificado'
                    }
                },
                pedidos: pedidosProcessados,
                origemHub: null, // Poderia buscar do hub se houver
                destinoHub: null  // Poderia buscar do hub se houver
            }
        };

        console.debug('Dados do romaneio da conferência:', dadosRomaneio);

        // Abrir janela do romaneio
        const baseUrl = API_BASE_URL.replace(/\/$/, '');
        const romaneioUrl = `${baseUrl}/romaneio.html`;
        const targetOrigin = new URL(baseUrl).origin;

        const janela = window.open(romaneioUrl, '_blank', 'width=1200,height=800,scrollbars=yes');

        if (!janela) {
            mostrarFeedback('Não foi possível abrir a janela do romaneio. Verifique se os pop-ups estão bloqueados.', 'error');
            return;
        }

        // Enviar dados para a janela do romaneio
        let tentativas = 0;
        const maxTentativas = 5;

        const tentarEnviarDados = () => {
            try {
                if (janela.closed) {
                    mostrarFeedback('Janela do romaneio foi fechada', 'warning');
                    return;
                }

                janela.postMessage(dadosRomaneio, targetOrigin);
                console.log('Dados do romaneio da conferência enviados com sucesso');

                // Verificar se a janela está pronta para receber os dados
                const verificarCarregamento = setInterval(() => {
                    if (janela.document.readyState === 'complete') {
                        clearInterval(verificarCarregamento);
                        janela.postMessage(dadosRomaneio, targetOrigin);
                    }
                }, 100);

            } catch (e) {
                tentativas++;
                if (tentativas < maxTentativas) {
                    console.warn(`Tentativa ${tentativas} falhou, tentando novamente...`, e);
                    setTimeout(tentarEnviarDados, 500);
                } else {
                    console.error('Falha ao enviar dados para o romaneio após', maxTentativas, 'tentativas');
                    mostrarFeedback('Erro ao carregar dados do romaneio. Tente novamente.', 'error');
                }
            }
        };

        setTimeout(tentarEnviarDados, 1000);

    } catch (error) {
        console.error('Erro ao visualizar romaneio da conferência:', error);
        mostrarFeedback('Erro ao visualizar romaneio: ' + error.message, 'error');
    }
}

/**
 * Gera um romaneio para uma conferência
 * @param {number} conferenciaId - ID da conferência
 */
async function gerarRomaneio(recursoId, tipoRecurso) {
    try {
        mostrarCarregamento(true);

        if (tipoRecurso === 'recebimento') {
            // Código existente para recebimentos...
            const recebimento = await apiRequest(`/recebimentos/${recursoId}`, 'GET');
            const pedidos = await apiRequest(`/recebimentos/${recursoId}/pedidos`, 'GET');
            pedidosIds = Array.isArray(pedidos) ? pedidos.map(p => p.id) : [];
        } else if (tipoRecurso === 'conferencia') {
            // Usar a nova função para conferências
            await gerarRomaneioConferencia(recursoId);
            return; // A função já lida com o feedback e recarregamento
        }

        // Código restante para recebimentos...
        if (pedidosIds.length === 0) {
            mostrarFeedback('Nenhum pedido encontrado para gerar romaneio', 'warning');
            return;
        }

        const response = await apiRequest('/manifestos/from-pedidos', 'POST', {
            pedidosIds: pedidosIds,
            tipo: 'ROMANEIO'
        });

        const romaneio = response.romaneio || response.manifesto || response;
        mostrarFeedback(`Romaneio ${romaneio.numero_romaneio || romaneio.numero_manifesto} criado com sucesso`, 'success');

        setTimeout(() => {
            visualizarRomaneio(recursoId, 'recebimento');
        }, 1000);

        await carregarRecebimentos({}, recebimentosCurrentPage);

    } catch (error) {
        console.error('Erro ao gerar romaneio:', error);
        mostrarFeedback('Erro ao gerar romaneio: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}




// ---------- Funções de Manifesto (MDF-e) ----------
async function visualizarManifesto(manifestoId) {
    try {
        const manifestoData = await apiRequest(`/manifestos/${manifestoId}`, 'GET');

        // Extrair dados principais
        const manifesto = manifestoData.manifesto || manifestoData;
        const notasApi = manifestoData.nota || manifestoData.notas || [];
        const pedidosApi = manifestoData.pedidos || [];

        // Processar notas para o formato esperado pelo MDF-e
        const notasProcessadas = [];

        // Agrupar notas por número (evitar duplicatas)
        const notasAgrupadas = {};

        notasApi.forEach(nota => {
            const chave = `${nota.numero}-${nota.serie}`;
            if (!notasAgrupadas[chave]) {
                notasAgrupadas[chave] = {
                    numero: nota.numero,
                    serie: nota.serie,
                    chave_nfe: nota.chave_nfe || null,
                    data_emissao: nota.data_emissao,
                    valor_total: nota.valor_total || 0,
                    emitente: 'Logistics XPRESS', // Valor padrão
                    itens: []
                };
            }

            // Adicionar itens da nota
            if (nota.notaItens && Array.isArray(nota.notaItens)) {
                nota.notaItens.forEach(item => {
                    notasAgrupadas[chave].itens.push({
                        produto: item.produtos || { nome: item.descricao || 'Produto não especificado' },
                        quantidade: item.quantidade,
                        valor_unitario: item.valor_unitario,
                        descricao: item.descricao
                    });
                });
            }
        });

        // Converter para array
        Object.values(notasAgrupadas).forEach(nota => {
            notasProcessadas.push(nota);
        });

        // Processar pedidos para o formato esperado pelo MDF-e
        const pedidosProcessados = [];

        pedidosApi.forEach(pedido => {
            // Calcular valor total do pedido
            let valorTotalPedido = 0;
            const itensPedido = [];

            if (pedido.itens && Array.isArray(pedido.itens)) {
                pedido.itens.forEach(item => {
                    const valorItem = (item.quantidade || 0) * (item.valor_unitario || 0);
                    valorTotalPedido += valorItem;

                    itensPedido.push({
                        produto: item.produtos || { nome: item.descricao || 'Produto não especificado' },
                        quantidade: item.quantidade,
                        valor_unitario: item.valor_unitario,
                        valor_total: valorItem
                    });
                });
            }

            // Obter informações de cliente e endereço
            const cliente = pedido.clientes || pedido.cliente || {};
            const endereco = pedido.enderecos || pedido.endereco || {};

            pedidosProcessados.push({
                id: pedido.id,
                codigo_pedido: pedido.codigo_pedido || pedido.codigo || `PED-${pedido.id}`,
                cliente: {
                    nome: cliente.nome || 'Cliente não informado',
                    cpf: cliente.cpf || null,
                    cnpj: cliente.cnpj || null,
                    telefone: cliente.telefone || '',
                    email: cliente.email || ''
                },
                endereco: {
                    rua: endereco.rua || '',
                    numero: endereco.numero || '',
                    complemento: endereco.complemento || '',
                    bairro: endereco.bairro || '',
                    cidade: endereco.cidade || '',
                    estado: endereco.estado || '',
                    cep: endereco.cep || ''
                },
                valor_total: valorTotalPedido,
                quantidade_itens: itensPedido.length,
                itens: itensPedido,
                status: pedido.status || 'AGUARDANDO_CONFERENCIA'
            });
        });

        // Preparar dados do manifesto
        const dadosManifesto = {
            tipo: 'manifesto:load',
            dadosManifesto: {
                manifesto: {
                    id: manifesto.id,
                    numero_manifesto: manifesto.numero_manifesto || `MAN-${manifesto.id}`,
                    serie: manifesto.serie || '1',
                    data_emissao: manifesto.data_emissao,
                    valor_total: manifesto.valor_total || 0,
                    quantidade_notas: manifesto.quantidade_notas || notasProcessadas.length,
                    observacoes: manifesto.observacoes || 'Nenhuma observação registrada.',

                    // Informações de origem e destino
                    origem_hub: manifesto.origemHub || manifesto.origem_hub || null,
                    destino_hub: manifesto.destinoHub || manifesto.destino_hub || null,

                    // Informações de transporte
                    transporte: manifesto.transportes || null,

                    // Informações do recebimento associado
                    recebimento: manifesto.recebimentos || null
                },
                notas: notasProcessadas,
                pedidos: pedidosProcessados
            }
        };

        // Abrir janela do MDF-e
        const baseUrl = API_BASE_URL.replace(/\/$/, '');
        const mdfeUrl = `${baseUrl}/mdf-e.html`;
        const targetOrigin = new URL(baseUrl).origin;

        const janela = window.open(mdfeUrl, '_blank', 'width=1200,height=800,scrollbars=yes');

        if (!janela) {
            mostrarFeedback('Não foi possível abrir a janela do manifesto. Verifique se os pop-ups estão bloqueados.', 'error');
            return;
        }

        // Enviar dados para a janela do MDF-e
        let tentativas = 0;
        const maxTentativas = 5;

        const tentarEnviarDados = () => {
            try {
                if (janela.closed) {
                    mostrarFeedback('Janela do manifesto foi fechada', 'warning');
                    return;
                }

                janela.postMessage(dadosManifesto, targetOrigin);
                console.log('Dados do manifesto enviados com sucesso:', dadosManifesto);

                // Verificar se a janela está pronta para receber os dados
                const verificarCarregamento = setInterval(() => {
                    if (janela.document.readyState === 'complete') {
                        clearInterval(verificarCarregamento);
                        janela.postMessage(dadosManifesto, targetOrigin);
                    }
                }, 100);

            } catch (e) {
                tentativas++;
                if (tentativas < maxTentativas) {
                    console.warn(`Tentativa ${tentativas} falhou, tentando novamente...`, e);
                    setTimeout(tentarEnviarDados, 500);
                } else {
                    console.error('Falha ao enviar dados para o manifesto após', maxTentativas, 'tentativas');
                    mostrarFeedback('Erro ao carregar dados do manifesto. Tente novamente.', 'error');
                }
            }
        };

        // Aguardar a janela carregar antes de enviar os dados
        setTimeout(tentarEnviarDados, 1000);

    } catch (error) {
        console.error('Erro ao visualizar manifesto:', error);
        mostrarFeedback('Erro ao visualizar manifesto: ' + error.message, 'error');
    }
}
// Função para gerar romaneio manualmente
async function gerarRomaneio(recursoId, tipoRecurso) {
    try {
        mostrarCarregamento(true);

        let pedidosIds = [];

        if (tipoRecurso === 'recebimento') {
            const recebimento = await apiRequest(`/recebimentos/${recursoId}`, 'GET');
            const pedidos = await apiRequest(`/recebimentos/${recursoId}/pedidos`, 'GET');
            pedidosIds = Array.isArray(pedidos) ? pedidos.map(p => p.id) : [];
        }

        if (pedidosIds.length === 0) {
            mostrarFeedback('Nenhum pedido encontrado para gerar romaneio', 'warning');
            return;
        }

        const response = await apiRequest('/manifestos/from-pedidos', 'POST', {
            pedidosIds: pedidosIds,
            tipo: 'ROMANEIO'
        });

        const romaneio = response.romaneio || response.manifesto || response;
        mostrarFeedback(`Romaneio ${romaneio.numero_romaneio || romaneio.numero_manifesto} criado com sucesso`, 'success');

        setTimeout(() => {
            visualizarRomaneio(recursoId);
        }, 1000);

        await carregarRecebimentos({}, recebimentosCurrentPage);

    } catch (error) {
        console.error('Erro ao gerar romaneio:', error);
        mostrarFeedback('Erro ao gerar romaneio: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

// Função para gerar manifesto manualmente
async function gerarManifesto(recursoId, tipoRecurso) {
    try {
        mostrarCarregamento(true);

        let pedidosIds = [];

        if (tipoRecurso === 'recebimento') {
            const recebimento = await apiRequest(`/recebimentos/${recursoId}`, 'GET');
            const pedidos = await apiRequest(`/recebimentos/${recursoId}/pedidos`, 'GET');
            pedidosIds = Array.isArray(pedidos) ? pedidos.map(p => p.id) : [];
        } else if (tipoRecurso === 'conferencia') {
            const conferencia = await apiRequest(`/conferencias/${recursoId}`, 'GET');
            const pedidos = await apiRequest(`/conferencias/${recursoId}/pedidos`, 'GET');
            pedidosIds = Array.isArray(pedidos) ? pedidos.map(p => p.id) : [];
        }

        if (pedidosIds.length === 0) {
            mostrarFeedback('Nenhum pedido encontrado para gerar manifesto', 'warning');
            return;
        }

        const response = await apiRequest('/manifestos/from-pedidos', 'POST', {
            pedidosIds: pedidosIds
        });

        const manifesto = response.manifesto || response;
        mostrarFeedback(`Manifesto ${manifesto.numero_manifesto} criado com ${manifesto.quantidade_notas || 0} notas`, 'success');

        if (tipoRecurso === 'conferencia') {
            const conferencia = await apiRequest(`/conferencias/${recursoId}`, 'GET');
            if (conferencia.tipo === 'OUTBOUND') {
                setTimeout(() => {
                    visualizarManifesto(manifesto.id);
                }, 1000);
            }
        }

        if (tipoRecurso === 'recebimento') {
            await carregarRecebimentos({}, recebimentosCurrentPage);
        } else if (tipoRecurso === 'conferencia') {
            await carregarConferencias(filtrosAtuaisConferencias, conferenciasCurrentPage);
        }

    } catch (error) {
        console.error('Erro ao gerar manifesto:', error);
        mostrarFeedback('Erro ao gerar manifesto: ' + error.message, 'error');
    } finally {
        mostrarCarregamento(false);
    }
}

// ---------- Exportar funções para o escopo global ----------
window.associarOperacao = associarOperacao;
window.adicionarPedidoConferencia = adicionarPedidoConferencia;
window.adicionarPedidoRecebimento = adicionarPedidoRecebimento;
window.validarPedidoManual = validarPedidoManual;
window.iniciarScannerModal = iniciarScannerModal;
window.pararScannerModal = pararScannerModal;
window.visualizarManifesto = visualizarManifesto;
window.gerarManifesto = gerarManifesto;
window.visualizarRomaneio = visualizarRomaneio;
window.gerarRomaneio = gerarRomaneio;
window.salvarConferencia = salvarConferencia;
window.salvarRecebimentoCompleto = salvarRecebimentoCompleto;
window.mostrarPreviewRecebimento = mostrarPreviewRecebimento;
window.visualizarRomaneioConferencia = visualizarRomaneioConferencia;
window.gerarRomaneioConferencia = gerarRomaneioConferencia;