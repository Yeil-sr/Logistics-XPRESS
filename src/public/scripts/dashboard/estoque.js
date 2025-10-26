// Este arquivo pode conter as funções principais que serão chamadas pelo estoque.html

async function carregarDadosEstoque() {
    try {
        const response = await fetch('/estoques');
        if (!response.ok) throw new Error('Erro ao carregar estoque');
        return await response.json();
    } catch (error) {
        console.error('Erro ao carregar estoque:', error);
        return [];
    }
}

async function carregarProdutos() {
    try {
        const response = await fetch('/produtos/');
        if (!response.ok) throw new Error('Erro ao carregar produtos');
        return await response.json();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        return [];
    }
}

async function carregarHubs() {
    try {
        const response = await fetch('/hubs/');
        if (!response.ok) throw new Error('Erro ao carregar hubs');
        return await response.json();
    } catch (error) {
        console.error('Erro ao carregar hubs:', error);
        return [];
    }
}

async function salvarItemEstoque(item) {
    try {
        const response = await fetch('/estoque/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        
        if (!response.ok) throw new Error('Erro ao salvar item');
        return await response.json();
    } catch (error) {
        console.error('Erro ao salvar item:', error);
        throw error;
    }
}

async function registrarMovimentacao(dados) {
    try {
        const response = await fetch('/estoque/movimentacao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (!response.ok) throw new Error('Erro ao registrar movimentação');
        return await response.json();
    } catch (error) {
        console.error('Erro ao registrar movimentação:', error);
        throw error;
    }
}

// Outras funções específicas podem ser adicionadas aqui