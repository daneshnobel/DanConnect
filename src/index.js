import React, { useContext } from 'react';
import ReactDOM from 'react-dom/client';

import 'bootstrap/dist/css/bootstrap.min.css';

import './index.scss';
import App from './App';
import PublicPage from './components/PublicPage';
import reportWebVitals from './reportWebVitals';
import {BrowserRouter as Router,Routes,Route} from 'react-router-dom';
import {useLocation,Navigate} from "react-router-dom";
import Home from './components/Home';
import AuthProvider, { AuthContext } from './api/authProvider';
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <AuthProvider >
  <Router>
  <Routes>
  <Route path="/" element={<PublicPage/>}></Route>
  <Route path="/app"  element={<RequireAuth>
    <App/>
  </RequireAuth>}>
      <Route path=""  element={<Home/>}></Route>
   </Route>
  </Routes>
  </Router>
  </AuthProvider>
);

function RequireAuth({children}){

  const auth = useContext(AuthContext);
  const location = useLocation();
  if(!auth.user){
    return <Navigate to="/" state={{from:location}} replace />
  }
  return children
}
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
