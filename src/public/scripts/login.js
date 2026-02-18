document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('.formLogin');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const senha_hash = document.getElementById('password').value;

    const loginData = { email, senha_hash };

    try {
      const response = await fetch('/usuarios/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
      });

      const result = await response.json();

      if (response.ok) {
        localStorage.setItem('token', result.token);

        localStorage.setItem('userData', JSON.stringify({
          id: result.id,
          nome: result.nome,
          email: result.email,
          role: result.role,
          status: result.status
        }));

        window.location.href = '/dashboard/gestao';
      } else {
        alert("Erro: " + (result.message || "Não foi possível autenticar."));
      }
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      alert("Erro ao fazer login. Tente novamente mais tarde.");
    }
  });
});
