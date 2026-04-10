(function(){
  const session = JSON.parse(localStorage.getItem('session'));

  if(!session){
    window.location.href='/login.html';
    return;
  }

  window.USER = session;
})();

function logout(){
  localStorage.removeItem('session');
  window.location.href='/login.html';
}
