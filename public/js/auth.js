function login(){
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;

  const users = [
    {email:'admin@clinica.com',senha:'123456',role:'admin'},
    {email:'medico@clinica.com',senha:'123456',role:'medico'},
    {email:'secretaria@clinica.com',senha:'123456',role:'secretaria'}
  ];

  const user = users.find(u=>u.email===email && u.senha===senha);

  if(!user){
    document.getElementById('error').innerText = 'Login inválido';
    return;
  }

  localStorage.setItem('session',JSON.stringify(user));
  window.location.href='/';
}
