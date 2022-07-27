import React, { useContext } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faCircle as circle, faCheck as check } from '@fortawesome/free-solid-svg-icons'
import "./Home.scss";
import logo from "./images/onvidacompact.png";
import { AuthContext } from "../api/authProvider";
import { useNavigate } from "react-router-dom";
import Chat from "./Chat";
export default function Default() {
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);
  const { user, signIn, signOut } = authContext;
  const profileHandler = (event) => {
    event.preventDefault();
    signOut(() => {
      navigate("/")
    })
  }

  return (
    <div className="layout d-flex flex-column h-100">
      <header>
        <nav class="navbar navbar-expand-md navbar-dark fixed-top">
          <div class="container-fluid">
            <a class="navbar-brand" href="#">
              <img src={logo} className="rounded-circle" />
              <h4 className="title">Onvida Cognizant</h4>
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
              <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" style={{
              paddingRight: "25px",
              flexDirection: "row-reverse"
            }} id="navbarCollapse">
              <form onSubmit={profileHandler}>
                <span onClick={profileHandler} className="fa-layers fa-fw login-icon">
                  <FontAwesomeIcon icon={circle} color="rgb(58, 179, 190)" size='3x' />
                  <FontAwesomeIcon icon={faUser} inverse transform="shrink-4 right-5" size='2x' />
                </span>

              </form>
            </div>
          </div>
        </nav>
      </header>

      <main class="flex-shrink-0">
        <div class="container d-flex justify-content-center align-items-center"
          style={{ height: "100%" }}
        >
          <Chat />
        </div>
      </main>

      <footer class="footer mt-auto py-3 bg-light">
        <div class="container">
          <span class="text-muted">
            <p class="small">© Copyright 2022. All Rights Reserved.</p>
          </span>
        </div>
      </footer>

    </div>
  )
}