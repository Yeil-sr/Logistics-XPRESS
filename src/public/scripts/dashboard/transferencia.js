const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8080'
    : 'https://logistics-xpress.vercel.app/';
let transferenciaAtual = null;
const pedidoTemplate = (pedidoId) => `
    <div class="pedido-item" data-pedido-id="${pedidoId}">
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">Pedido ${pedidoId}</h6>
            <button type="button" class="btn btn-danger btn-sm btn-remove" onclick="removePedido(${pedidoId})">
                <i class="fas fa-trash"></i> Remover
            </button>
        </div>
        
        <div class="row">
            <div class="col-md-12">
                <div class="form-group">
                    <label for="pedido-codigo-${pedidoId}">Código do Pedido *</label>
                    <input type="text" class="form-control pedido-codigo" id="pedido-codigo-${pedidoId}" required>
                </div>
            </div>
        </div>

        <div class="mb-3">
            <button type="button" class="btn btn-primary btn-sm" onclick="addItemToPedido(${pedidoId})">
                <i class="fas fa-plus"></i> Adicionar Item
            </button>
        </div>

        <div class="itens-container" id="itens-container-${pedidoId}">
            <!-- Itens serão adicionados aqui -->
        </div>

        <div class="card mt-3">
            <div class="card-header bg-light">
                <h6 class="card-title mb-0">Informações do Cliente</h6>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="cliente-nome-${pedidoId}">Nome do Cliente</label>
                            <input type="text" class="form-control cliente-nome" id="cliente-nome-${pedidoId}">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="cliente-cpf-${pedidoId}">CPF</label>
                            <input type="text" class="form-control cliente-cpf" id="cliente-cpf-${pedidoId}">
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group">
                            <label for="endereco-cep-${pedidoId}">CEP</label>
                            <input type="text" class="form-control endereco-cep" id="endereco-cep-${pedidoId}">
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="form-group">
                            <label for="endereco-rua-${pedidoId}">Rua</label>
                            <input type="text" class="form-control endereco-rua" id="endereco-rua-${pedidoId}">
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="endereco-cidade-${pedidoId}">Cidade</label>
                            <input type="text" class="form-control endereco-cidade" id="endereco-cidade-${pedidoId}">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="endereco-estado-${pedidoId}">Estado</label>
                            <input type="text" class="form-control endereco-estado" id="endereco-estado-${pedidoId}">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
const itemTemplate = (pedidoId, itemId) => `
    <div class="item-produto" data-item-id="${itemId}">
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">Item ${itemId}</h6>
            <button type="button" class="btn btn-danger btn-sm" onclick="removeItemFromPedido(${pedidoId}, ${itemId})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="row">
            <div class="col-md-6">
                <div class="form-group">
                    <label for="produto-nome-${pedidoId}-${itemId}">Nome do Produto</label>
                    <input type="text" class="form-control produto-nome" id="produto-nome-${pedidoId}-${itemId}">
                </div>
            </div>
            <div class="col-md-6">
                <div class="form-group">
                    <label for="produto-descricao-${pedidoId}-${itemId}">Descrição</label>
                    <input type="text" class="form-control produto-descricao" id="produto-descricao-${pedidoId}-${itemId}">
                </div>
            </div>
        </div>
        <div class="row">
            <div class="col-md-3">
                <div class="form-group">
                    <label for="produto-preco-${pedidoId}-${itemId}">Preço</label>
                    <input type="number" step="0.01" class="form-control produto-preco" id="produto-preco-${pedidoId}-${itemId}">
                </div>
            </div>
            <div class="col-md-3">
                <div class="form-group">
                    <label for="produto-peso-${pedidoId}-${itemId}">Peso (kg)</label>
                    <input type="number" step="0.01" class="form-control produto-peso" id="produto-peso-${pedidoId}-${itemId}">
                </div>
            </div>
            <div class="col-md-3">
                <div class="form-group">
                    <label for="quantidade-${pedidoId}-${itemId}">Quantidade</label>
                    <input type="number" class="form-control quantidade" id="quantidade-${pedidoId}-${itemId}" value="1">
                </div>
            </div>
            <div class="col-md-3">
                <div class="form-group">
                    <label for="valor-unitario-${pedidoId}-${itemId}">Valor Unitário</label>
                    <input type="number" step="0.01" class="form-control valor-unitario" id="valor-unitario-${pedidoId}-${itemId}">
                </div>
            </div>
        </div>
        <div class="form-group">
            <label for="descricao-item-${pedidoId}-${itemId}">Descrição do Item</label>
            <input type="text" class="form-control descricao-item" id="descricao-item-${pedidoId}-${itemId}">
        </div>
    </div>
`;

function calcularValorTotal(pedidos) {
    if (!Array.isArray(pedidos)) return 0;
    
    return pedidos.reduce((total, pedido) => {
        const valorPedido = pedido.valor_total || 
            (Array.isArray(pedido.itens) ? 
                pedido.itens.reduce((sum, item) => sum + (item.valor_total || 0), 0) : 0);
        return total + valorPedido;
    }, 0);
}

function enviarDadosComRetry(janela, dados, targetOrigin, tipo) {
    let tentativas = 0;
    const maxTentativas = 5;
    
    const tentarEnviar = () => {
        try {
            janela.postMessage(dados, targetOrigin);
            console.log(`Dados do ${tipo} enviados com sucesso`);
        } catch (e) {
            tentativas++;
            if (tentativas < maxTentativas) {
                setTimeout(tentarEnviar, 300);
            } else {
                console.error(`Falha ao enviar dados para o ${tipo} após ${maxTentativas} tentativas`);
                alert(`Erro ao carregar dados do ${tipo}. A página pode não ter carregado corretamente.`);
            }
        }
    };
    
    setTimeout(tentarEnviar, 500);
}

function atualizarBotoesDocumentos() {
    const btnGerarManifesto = document.getElementById('btn-gerar-manifesto');
    const btnImprimirManifesto = document.getElementById('btn-imprimir-manifesto');
    const btnGerarRomaneio = document.getElementById('btn-gerar-romaneio');
    const btnImprimirRomaneio = document.getElementById('btn-imprimir-romaneio');
    
    const hasManifesto = !!transferenciaAtual?.manifesto;
    const hasRomaneio = !!transferenciaAtual?.manifesto?.romaneio_url;
    
    if (btnGerarManifesto) {
        btnGerarManifesto.style.display = hasManifesto ? 'none' : 'block';
    }
    if (btnImprimirManifesto) {
        btnImprimirManifesto.style.display = hasManifesto ? 'block' : 'none';
    }
    if (btnGerarRomaneio) {
        btnGerarRomaneio.style.display = (hasManifesto && !hasRomaneio) ? 'block' : 'none';
    }
    if (btnImprimirRomaneio) {
        btnImprimirRomaneio.style.display = (hasRomaneio || hasManifesto) ? 'block' : 'none';
    }
}

let nextPedidoId = 1;
let nextItemId = 1;

function addPedido() {
    const container = document.getElementById('pedidos-container');
    const pedidoId = nextPedidoId++;
    container.insertAdjacentHTML('beforeend', pedidoTemplate(pedidoId));
}

function removePedido(pedidoId) {
    const pedidoElement = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
    if (pedidoElement) {
        pedidoElement.remove();
    }
}

function addItemToPedido(pedidoId) {
    const container = document.getElementById(`itens-container-${pedidoId}`);
    const itemId = nextItemId++;
    container.insertAdjacentHTML('beforeend', itemTemplate(pedidoId, itemId));
}

function removeItemFromPedido(pedidoId, itemId) {
    const itemElement = document.querySelector(`[data-pedido-id="${pedidoId}"] [data-item-id="${itemId}"]`);
    if (itemElement) {
        itemElement.remove();
    }
}

async function carregarHubs() {
    try {
        const hubs = await apiRequest('/hubs');
        
        const origemSelect = document.getElementById('origem-hub');
        const destinoSelect = document.getElementById('destino-hub');
        
        if (origemSelect) {
            origemSelect.innerHTML = '<option value="">Selecione o hub de origem</option>';
        }
        
        if (destinoSelect) {
            destinoSelect.innerHTML = '<option value="">Selecione o hub de destino</option>';
        }
        
        hubs.forEach(hub => {
            if (origemSelect) {
                const option = document.createElement('option');
                option.value = hub.nome; 
                option.textContent = hub.nome;
                origemSelect.appendChild(option);
            }
            
            if (destinoSelect) {
                const option = document.createElement('option');
                option.value = hub.nome;
                option.textContent = hub.nome;
                destinoSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Erro ao carregar hubs:', error);
        alert('Erro ao carregar hubs');
    }
}

async function carregarMotoristas() {
    try {
        const motoristas = await apiRequest('/motoristas');
        
        const select = document.getElementById('motorista-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">Selecione um motorista</option>';
        
        motoristas.forEach(motorista => {
            const option = document.createElement('option');
            option.value = motorista.id;
            option.textContent = motorista.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar motoristas:', error);
        alert('Erro ao carregar motoristas');
    }
}

function buildPayload() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const payload = {
        numero_manifesto: document.getElementById('numero-manifesto').value || undefined,
        serie: document.getElementById('serie').value || undefined,
        data_emissao: document.getElementById('data-emissao').value ? 
            new Date(document.getElementById('data-emissao').value).toISOString() : undefined,
        origem_hub_nome: document.getElementById('origem-hub').value,
        destino_hub_nome: document.getElementById('destino-hub').value,
        tipo_tarefa: document.getElementById('tipo-tarefa').value,
        usuario_id: userData.id || 1, 
        createMissingPedidos: document.getElementById('create-missing-pedidos').checked,
        observacoes: document.getElementById('observacoes').value || undefined
    };

    payload.pedidosCodigos = [];
    payload.pedidosItens = {};
    payload.pedidosMeta = {};

    document.querySelectorAll('.pedido-item').forEach(pedidoElement => {
        const codigo = pedidoElement.querySelector('.pedido-codigo').value;
        if (!codigo) return;

        payload.pedidosCodigos.push(codigo);

        const itens = [];
        pedidoElement.querySelectorAll('.item-produto').forEach(itemElement => {
            const produto_nome = itemElement.querySelector('.produto-nome').value;
            const produto_descricao = itemElement.querySelector('.produto-descricao').value;
            const produto_preco = parseFloat(itemElement.querySelector('.produto-preco').value) || 0;
            const produto_peso_kg = parseFloat(itemElement.querySelector('.produto-peso').value) || 0;
            const quantidade = parseInt(itemElement.querySelector('.quantidade').value) || 1;
            const valor_unitario = parseFloat(itemElement.querySelector('.valor-unitario').value) || 0;
            const descricao = itemElement.querySelector('.descricao-item').value;

            itens.push({
                produto: {
                    nome: produto_nome,
                    descricao: produto_descricao,
                    preco: produto_preco,
                    peso_kg: produto_peso_kg
                },
                quantidade: quantidade,
                valor_unitario: valor_unitario,
                descricao: descricao
            });
        });

        payload.pedidosItens[codigo] = itens;

        const cliente_nome = pedidoElement.querySelector('.cliente-nome').value;
        const cliente_cpf = pedidoElement.querySelector('.cliente-cpf').value;
        const endereco_cep = pedidoElement.querySelector('.endereco-cep').value;
        const endereco_rua = pedidoElement.querySelector('.endereco-rua').value;
        const endereco_cidade = pedidoElement.querySelector('.endereco-cidade').value;
        const endereco_estado = pedidoElement.querySelector('.endereco-estado').value;

        payload.pedidosMeta[codigo] = {
            cliente: {
                nome: cliente_nome,
                cpf: cliente_cpf
            },
            endereco: {
                cep: endereco_cep,
                rua: endereco_rua,
                cidade: endereco_cidade,
                estado: endereco_estado
            }
        };
    });

    const transportador_nome = document.getElementById('transportador-nome').value;
    const placa_veiculo = document.getElementById('placa-veiculo').value;
    const quantidade_volume = document.getElementById('quantidade-volume').value;
    const peso_bruto = document.getElementById('peso-bruto').value;

    if (transportador_nome || placa_veiculo || quantidade_volume || peso_bruto) {
        payload.transferencia = {
            transporte: {
                transportador_nome: transportador_nome || undefined,
                placa_veiculo: placa_veiculo || undefined,
                quantidade_volume: quantidade_volume ? parseInt(quantidade_volume) : undefined,
                peso_bruto: peso_bruto ? parseFloat(peso_bruto) : undefined
            }
        };
    }

    return payload;
}

function validarFormulario() {
    const origem = document.getElementById('origem-hub').value;
    const destino = document.getElementById('destino-hub').value;
    const tipoTarefa = document.getElementById('tipo-tarefa').value;

    if (!origem || !destino || !tipoTarefa) {
        alert('Preencha todos os campos obrigatórios em "Hubs e Tipo de Tarefa"');
        return false;
    }

    const pedidos = document.querySelectorAll('.pedido-item');
    if (pedidos.length === 0) {
        alert('Adicione pelo menos um pedido');
        return false;
    }

    let pedidosValidos = true;
    document.querySelectorAll('.pedido-codigo').forEach(input => {
        if (!input.value.trim()) {
            pedidosValidos = false;
            input.focus();
        }
    });

    if (!pedidosValidos) {
        alert('Todos os pedidos devem ter um código');
        return false;
    }

    return true;
}


async function obterDadosCompletosTransferencia(transferenciaId) {
    try {
        const transferencia = await apiRequest(`/transferencias/${transferenciaId}`);
        const pedidos = await apiRequest(`/transferencias/${transferenciaId}/pedidos`);
        
        const pedidosCompletos = await Promise.all(
            pedidos.map(async (pedido) => {
                try {
                    const itens = await apiRequest(`/pedidos/${pedido.id}/itens`).catch(() => []);
                    const meta = await apiRequest(`/pedidos/${pedido.id}/meta`).catch(() => null);
                    
                    const valor_total = Array.isArray(itens) ? 
                        itens.reduce((sum, item) => sum + (item.valor_total || 0), 0) : 0;
                    
                    return {
                        ...pedido,
                        itens: itens || [],
                        meta: meta || null,
                        valor_total: valor_total
                    };
                } catch (error) {
                    console.warn(`Erro ao carregar dados completos do pedido ${pedido.id}:`, error);
                    return {
                        ...pedido,
                        itens: [],
                        meta: null,
                        valor_total: 0
                    };
                }
            })
        );

        return {
            transferencia,
            pedidos: pedidosCompletos,
            notas: [] 
        };
    } catch (error) {
        console.error('Erro ao obter dados completos da transferência:', error);
        throw error;
    }
}

async function abrirManifestoComDados() {
    if (!transferenciaAtual) {
        alert('Transferência não carregada');
        return;
    }

    try {
        const dadosCompletos = await obterDadosCompletosTransferencia(transferenciaAtual.id);
        
        const origemHub = await apiRequest(`/hubs/${transferenciaAtual.origem_hub_id}`, 'GET').catch(() => null);
        const destinoHub = await apiRequest(`/hubs/${transferenciaAtual.destino_hub_id}`, 'GET').catch(() => null);
        
        const baseUrl = API_BASE.replace(/\/$/, '');
        const mdfeUrl = `${baseUrl}/mdf-e.html`;
        const targetOrigin = new URL(baseUrl).origin;
        
        const janela = window.open(mdfeUrl, '_blank');
        
        if (!janela) {
            alert('Não foi possível abrir a janela do manifesto. Verifique se os pop-ups estão bloqueados.');
            return;
        }
        
        const dadosManifesto = {
            tipo: 'manifesto:load',
            dadosManifesto: {
                manifesto: transferenciaAtual.manifesto || {
                    id: transferenciaAtual.id,
                    numero_manifesto: transferenciaAtual.numero_TO,
                    serie: "1",
                    data_emissao: transferenciaAtual.data_criacao,
                    origem_hub: origemHub,
                    destino_hub: destinoHub,
                    valor_total: calcularValorTotal(dadosCompletos.pedidos),
                    quantidade_notas: dadosCompletos.pedidos?.length || 0
                },
                notas: dadosCompletos.notas || [],
                pedidos: dadosCompletos.pedidos || []
            }
        };
        
        enviarDadosComRetry(janela, dadosManifesto, targetOrigin, 'manifesto');
        
    } catch (error) {
        console.error('Erro ao abrir manifesto:', error);
        alert('Erro ao abrir manifesto: ' + error.message);
    }
}

async function abrirRomaneioComDados() {
    if (!transferenciaAtual) {
        alert('Transferência não carregada');
        return;
    }

    try {
        const dadosCompletos = await obterDadosCompletosTransferencia(transferenciaAtual.id);
        
        const origemHub = await apiRequest(`/hubs/${transferenciaAtual.origem_hub_id}`, 'GET').catch(() => null);
        const destinoHub = await apiRequest(`/hubs/${transferenciaAtual.destino_hub_id}`, 'GET').catch(() => null);
        
        const baseUrl = API_BASE.replace(/\/$/, '');
        const romaneioUrl = `${baseUrl}/romaneio.html`;
        const targetOrigin = new URL(baseUrl).origin;
        
        const janela = window.open(romaneioUrl, '_blank');
        
        if (!janela) {
            alert('Não foi possível abrir a janela do romaneio. Verifique se os pop-ups estão bloqueados.');
            return;
        }
        
        const dadosRomaneio = {
            tipo: 'romaneio:load',
            dadosRomaneio: {
                recebimento: { 
                    id: transferenciaAtual.id,
                    numero_manifesto: transferenciaAtual.numero_TO,
                    status: transferenciaAtual.status,
                    data_criacao: transferenciaAtual.data_criacao,
                    origem_hub_id: transferenciaAtual.origem_hub_id,
                    destino_hub_id: transferenciaAtual.destino_hub_id,
                    origemHub: origemHub,
                    destinoHub: destinoHub
                },
                pedidos: dadosCompletos.pedidos || [],
                origemHub: origemHub,
                destinoHub: destinoHub
            }
        };
        
        enviarDadosComRetry(janela, dadosRomaneio, targetOrigin, 'romaneio');
        
    } catch (error) {
        console.error('Erro ao abrir romaneio:', error);
        alert('Erro ao abrir romaneio: ' + error.message);
    }
}

async function gerarManifesto() {
    if (!transferenciaAtual) {
        alert('Transferência não carregada');
        return;
    }

    if (!confirm('Deseja gerar o manifesto para esta transferência?')) {
        return;
    }

    const btn = document.getElementById('btn-gerar-manifesto');
    toggleLoading(btn, true);

    try {
        const payload = {
            numero_manifesto: `MAN-${transferenciaAtual.numero_TO || 'TO'}-${Date.now()}`,
            serie: "1",
            data_emissao: new Date().toISOString(),
            origem_hub_nome: transferenciaAtual.origemHub?.nome || transferenciaAtual.origem_hub_id,
            destino_hub_nome: transferenciaAtual.destinoHub?.nome || transferenciaAtual.destino_hub_id,
            pedidosCodigos: transferenciaAtual.pedidos?.map(p => p.codigo_pedido) || [],
            transferencia: {
                transporte: {
                    transportador_nome: transferenciaAtual.Motoristas?.nome || '',
                    placa_veiculo: transferenciaAtual.transportes?.[0]?.placa_veiculo || '',
                    quantidade_volume: transferenciaAtual.quantidade || 0,
                    peso_bruto: transferenciaAtual.peso_kg || 0
                }
            },
            observacoes: `Manifesto gerado automaticamente para transferência ${transferenciaAtual.numero_TO}`
        };

        console.log('Enviando payload para gerar manifesto:', payload);
        
        const manifesto = await apiRequest('/manifestos', 'POST', payload);
        
        transferenciaAtual.manifesto = manifesto;
        
        await carregarDocumentosTransferencia(transferenciaAtual.id);
        atualizarBotoesDocumentos();
        
        carregarTimelineTransferencia(transferenciaAtual);
        
        alert('Manifesto gerado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao gerar manifesto:', error);
        alert('Erro ao gerar manifesto: ' + (error.message || 'Erro desconhecido'));
    } finally {
        toggleLoading(btn, false);
    }
}

async function gerarRomaneio() {
    if (!transferenciaAtual?.manifesto?.id) {
        alert('Primeiro gere o manifesto');
        return;
    }

    if (!confirm('Deseja gerar o romaneio (packing list) para este manifesto?')) {
        return;
    }

    const btn = document.getElementById('btn-gerar-romaneio');
    toggleLoading(btn, true);

    try {
        const response = await apiRequest(`/manifestos/${transferenciaAtual.manifesto.id}/romaneio`, 'POST', {});
        
        if (response.romaneio_pdf_url) {
            transferenciaAtual.manifesto.romaneio_url = response.romaneio_pdf_url;
        } else if (response.romaneio_url) {
            transferenciaAtual.manifesto.romaneio_url = response.romaneio_url;
        }
        
        await carregarDocumentosTransferencia(transferenciaAtual.id);
        atualizarBotoesDocumentos();
        
        carregarTimelineTransferencia(transferenciaAtual);
        
        alert('Romaneio gerado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao gerar romaneio:', error);
        alert('Erro ao gerar romaneio: ' + (error.message || 'Erro desconhecido'));
    } finally {
        toggleLoading(btn, false);
    }
}

async function carregarDocumentosTransferencia(transferenciaId) {
    try {
        const documentos = await apiRequest(`/transferencias/${transferenciaId}/documentos`);
        const container = document.getElementById('lista-documentos');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!documentos || documentos.length === 0) {
            container.innerHTML = '<li class="list-group-item text-center text-muted">Nenhum documento gerado</li>';
            return;
        }
        
        documentos.forEach(doc => {
            const listItem = document.createElement('li');
            listItem.className = `list-group-item documento-item documento-${doc.tipo}`;
            
            const icon = getDocumentIcon(doc.tipo);
            const dataFormatada = doc.created_at ? new Date(doc.created_at).toLocaleString('pt-BR') : 'N/A';
            
            listItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <i class="${icon} mr-2"></i>
                            <strong class="text-capitalize">${doc.tipo}</strong>
                        </div>
                        <small class="text-muted d-block">Gerado em: ${dataFormatada}</small>
                        ${doc.numero ? `<small class="text-muted d-block">Número: ${doc.numero}</small>` : ''}
                    </div>
                    <div class="btn-group ml-2 documento-actions">
                        <button onclick="imprimirDocumento('${doc.tipo}')" class="btn btn-sm btn-outline-primary">
                            <i class="fas fa-print"></i> Imprimir
                        </button>
                        ${doc.url ? `
                            <a href="${doc.url}" target="_blank" class="btn btn-sm btn-outline-secondary">
                                <i class="fas fa-eye"></i>
                            </a>
                            <a href="${doc.url}" download class="btn btn-sm btn-outline-info">
                                <i class="fas fa-download"></i>
                            </a>
                        ` : ''}
                    </div>
                </div>
            `;
            
            container.appendChild(listItem);
        });
        
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        const container = document.getElementById('lista-documentos');
        if (container) {
            container.innerHTML = '<li class="list-group-item text-center text-danger">Erro ao carregar documentos</li>';
        }
    }
}

function imprimirDocumento(tipo) {
    if (!transferenciaAtual) {
        alert('Transferência não carregada');
        return;
    }
    
    switch(tipo) {
        case 'manifesto':
            imprimirManifesto();
            break;
        case 'romaneio':
            imprimirRomaneio();
            break;
        default:
            alert('Tipo de documento não suportado para impressão');
    }
}

function getDocumentIcon(tipo) {
    const icons = {
        'manifesto': 'fas fa-file-contract text-success',
        'romaneio': 'fas fa-clipboard-list text-warning',
        'nota': 'fas fa-file-invoice-dollar text-danger',
        'default': 'fas fa-file text-primary'
    };
    return icons[tipo] || icons.default;
}

function abrirModalTransferencia() {
    document.getElementById('form-transferencia').reset();
    document.getElementById('pedidos-container').innerHTML = '';
    nextPedidoId = 1;
    nextItemId = 1;
    
    addPedido();

    const modalElement = document.getElementById('modal-transferencia');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

async function salvarTransferencia() {
    if (!validarFormulario()) {
        return;
    }

    const payload = buildPayload();
    
    try {
        toggleLoading(document.getElementById('btn-salvar-transferencia'), true);
        
        console.log('Enviando payload:', payload);
        await apiRequest('/transferencias', 'POST', payload);
        
        alert('Transferência criada com sucesso!');
        
        const modalElement = document.getElementById('modal-transferencia');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
        }
        
        construirTabelaTransferencias();
    } catch (error) {
        console.error('Erro ao criar transferência:', error);
        alert('Erro ao criar transferência: ' + (error.message || 'Erro desconhecido'));
    } finally {
        toggleLoading(document.getElementById('btn-salvar-transferencia'), false);
    }
}

async function obterListaTransferencias() {
    try {
        return await apiRequest('/transferencias');
    } catch (error) {
        console.error('Erro ao obter lista de transferências:', error);
        throw error;
    }
}

async function construirTabelaTransferencias() {
    const container = document.getElementById('transferenciasContainer');
    if (!container) return;
    
    try {
        const transferencias = await obterListaTransferencias();
        container.innerHTML = '';

        if (transferencias.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Nenhuma transferência encontrada</div>';
            return;
        }

        const tabela = document.createElement('table');
        tabela.classList.add('table', 'table-hover', 'table-striped');
        tabela.innerHTML = `
            <thead>
                <tr>
                    <th>Nº TO</th>
                    <th>Motorista</th>
                    <th>Origem</th>
                    <th>Destino</th>
                    <th>Status</th>
                    <th>Data Criação</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = tabela.querySelector('tbody');
        transferencias.forEach(transf => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${transf.numero_TO || '-'}</td>
                <td>${transf.Motorista?.nome || '-'}</td>
                <td>${transf.origemHub?.nome || transf.origem_hub_id}</td>
                <td>${transf.destinoHub?.nome || transf.destino_hub_id}</td>
                <td><span class="badge ${getStatusBadgeClass(transf.status)}">${transf.status}</span></td>
                <td>${new Date(transf.data_criacao).toLocaleString()}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="verDetalhesTransferencia('${transf.id}')">Detalhes</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirTransferencia('${transf.id}')">Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        container.appendChild(tabela);
    } catch (error) {
        container.innerHTML = '<div class="alert alert-danger">Erro ao carregar transferências</div>';
    }
}

function getStatusBadgeClass(status) {
    const classes = {
        'CRIADO': 'badge-secondary',
        'EM_TRANSPORTE': 'badge-primary',
        'RECEBIDO': 'badge-success',
        'CANCELADO': 'badge-danger'
    };
    return classes[status] || 'badge-secondary';
}

function verDetalhesTransferencia(id) {
    window.location.href = `/dashboard/transferencia?id=${id}`;
}

async function carregarDetalhesTransferencia(id) {
    try {
        const listaView = document.getElementById('lista-view');
        const detalheView = document.getElementById('detalhe-view');
        const pageTitle = document.getElementById('page-title');
        
        if (listaView) listaView.style.display = 'none';
        if (detalheView) detalheView.style.display = 'block';
        if (pageTitle) pageTitle.textContent = 'Detalhes da Transferência';

        const transferencia = await apiRequest(`/transferencias/${id}`);
        transferenciaAtual = transferencia;

        const origemHub = await apiRequest(`/hubs/${transferencia.origem_hub_id}`, 'GET').catch(() => null);
        const destinoHub = await apiRequest(`/hubs/${transferencia.destino_hub_id}`, 'GET').catch(() => null);
        
        transferenciaAtual.origemHub = origemHub;
        transferenciaAtual.destinoHub = destinoHub;

        const numeroTo = document.getElementById('numero-to');
        const hubOrigem = document.getElementById('hub-origem');
        const hubDestino = document.getElementById('hub-destino');
        const motorista = document.getElementById('motorista');
        const dataCriacao = document.getElementById('data-criacao');
        const statusElement = document.getElementById('status-transferencia');
        const btnConcluir = document.getElementById('btn-concluir-transferencia');
        
        if (numeroTo) numeroTo.textContent = transferencia.numero_TO || '-';
        if (hubOrigem) hubOrigem.textContent = transferencia.origemHub?.nome || transferencia.origem_hub_id;
        if (hubDestino) hubDestino.textContent = transferencia.destinoHub?.nome || transferencia.destino_hub_id;
        if (motorista) motorista.textContent = transferencia.Motoristas?.nome || '-';
        if (dataCriacao) dataCriacao.textContent = new Date(transferencia.data_criacao).toLocaleString();

        if (statusElement) {
            statusElement.textContent = transferencia.status;
            statusElement.className = `badge ${getStatusBadgeClass(transferencia.status)}`;
        }

        if (btnConcluir) {
            btnConcluir.style.display = transferencia.status === 'EM_TRANSPORTE' ? 'block' : 'none';
            
            const newBtn = btnConcluir.cloneNode(true);
            btnConcluir.parentNode.replaceChild(newBtn, btnConcluir);
            newBtn.addEventListener('click', concluirTransferencia);
        }

        await carregarDocumentosTransferencia(id);
        
        atualizarBotoesDocumentos();
        
        configurarEventosDocumentos();
        
        carregarTimelineTransferencia(transferencia);
        await carregarPedidosTransferencia(id);

    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        const detalheView = document.getElementById('detalhe-view');
        if (detalheView) {
            detalheView.innerHTML = '<div class="alert alert-danger">Erro ao carregar transferência</div>';
        }
    }
}

async function carregarPedidosTransferencia(transferenciaId) {
    try {
        const pedidos = await apiRequest(`/transferencias/${transferenciaId}/pedidos`);
        const tbody = document.getElementById('tabela-pedidos');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum pedido encontrado</td></tr>';
            return;
        }

        pedidos.forEach(pedido => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${pedido.codigo_pedido || '-'}</td>
                <td>${pedido.clientes?.nome || '-'}</td>
                <td>${pedido.produtos?.nome || '-'}</td>
                <td>${pedido.status || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        const tbody = document.getElementById('tabela-pedidos');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar pedidos</td></tr>';
        }
    }
}

function carregarTimelineTransferencia(transferencia) {
    const container = document.getElementById('timeline-transferencia');
    if (!container) return;
    
    container.innerHTML = '';
    
    const steps = [
        { 
            event: 'Transferência criada', 
            date: transferencia.data_criacao, 
            active: true 
        },
        { 
            event: 'Transporte iniciado', 
            date: transferencia.data_inicio_transporte, 
            active: transferencia.status === 'EM_TRANSPORTE' || transferencia.status === 'RECEBIDO' 
        }
    ];
    
    if (transferencia.manifesto) {
        steps.push({
            event: 'Manifesto gerado',
            date: transferencia.manifesto.created_at,
            active: true
        });
    }
    
    if (transferencia.manifesto?.romaneio_url) {
        steps.push({
            event: 'Romaneio gerado',
            date: new Date().toISOString(), 
            active: true
        });
    }
    
    steps.push({ 
        event: 'Transferência concluída', 
        date: transferencia.data_conclusao, 
        active: transferencia.status === 'RECEBIDO' 
    });
    
    steps.forEach((step, index) => {
        const stepElement = document.createElement('div');
        stepElement.className = `timeline-step ${step.active ? 'active' : ''}`;
        
        stepElement.innerHTML = `
            <h5>${step.event}</h5>
            <small>${step.date ? new Date(step.date).toLocaleString() : 'Pendente'}</small>
            ${index < steps.length - 1 ? '<div class="timeline-connector"></div>' : ''}
        `;
        
        container.appendChild(stepElement);
    });
}

async function concluirTransferencia() {
    if (!transferenciaAtual || !confirm('Deseja concluir esta transferência?')) return;
    
    try {
        await apiRequest(`/transferencias/${transferenciaAtual.id}/concluir`, 'POST');
        
        alert('Transferência concluída com sucesso!');
        carregarDetalhesTransferencia(transferenciaAtual.id);
    } catch (error) {
        console.error('Erro ao concluir transferência:', error);
        alert('Erro ao concluir transferência');
    }
}

async function excluirTransferencia(id) {
    if (!confirm('Deseja realmente excluir esta transferência?')) return;
    
    try {
        await apiRequest(`/transferencias/${id}`, 'DELETE');
        
        alert('Transferência excluída com sucesso!');
        construirTabelaTransferencias();
    } catch (error) {
        console.error('Erro ao excluir transferência:', error);
        alert('Erro ao excluir transferência');
    }
}

function voltarParaLista() {
    window.location.href = '/dashboard/transferencia';
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


function configurarEventosDocumentos() {
    const btnGerarManifesto = document.getElementById('btn-gerar-manifesto');
    const btnImprimirManifesto = document.getElementById('btn-imprimir-manifesto');
    const btnGerarRomaneio = document.getElementById('btn-gerar-romaneio');
    const btnImprimirRomaneio = document.getElementById('btn-imprimir-romaneio');
    
    if (btnGerarManifesto) {
        btnGerarManifesto.addEventListener('click', gerarManifesto);
    }
    if (btnImprimirManifesto) {
        btnImprimirManifesto.addEventListener('click', imprimirManifesto);
    }
    if (btnGerarRomaneio) {
        btnGerarRomaneio.addEventListener('click', gerarRomaneio);
    }
    if (btnImprimirRomaneio) {
        btnImprimirRomaneio.addEventListener('click', imprimirRomaneio);
    }
}

function imprimirManifesto() {
    abrirManifestoComDados();
}

function imprimirRomaneio() {
    abrirRomaneioComDados();
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
            console.warn('Token inválido ou não fornecido');
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
        const url = new URL(API_BASE + path);
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


document.addEventListener('DOMContentLoaded', function() {
    if (!verificarAutenticacao()) return;

    const urlParams = new URLSearchParams(window.location.search);
    const transferenciaId = urlParams.get('id');
    
    if (transferenciaId) {
        carregarDetalhesTransferencia(transferenciaId);
    } else {
        construirTabelaTransferencias();
        carregarHubs();
        carregarMotoristas();
    }

    const btnAddPedido = document.getElementById('btn-add-pedido');
    if (btnAddPedido) {
        btnAddPedido.addEventListener('click', addPedido);
    }

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.id) {
        document.getElementById('usuario-id').value = userData.id;
    }

    configurarEventosDocumentos();

    const btnSalvar = document.getElementById('btn-salvar-transferencia');
    const btnConcluir = document.getElementById('btn-concluir-transferencia');
    
    if (btnSalvar) {
        btnSalvar.addEventListener('click', salvarTransferencia);
    }
    
    if (btnConcluir) {
        btnConcluir.addEventListener('click', concluirTransferencia);
    }

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
});