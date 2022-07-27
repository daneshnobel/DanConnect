import React, { useContext } from "react";
import { ReactDOM } from "react";
import "./PublicPage.scss";
import logo from "./images/logo.png";
import {useLocation,useNavigate} from "react-router-dom";
import { AuthContext } from "../api/authProvider";

export default function PublicPage() {
  const navigate = useNavigate();
  const location = useLocation();
 const authContext = useContext(AuthContext);
  const onSubmitHandler = (event) => {

    debugger;
    event.preventDefault();
    const to = location.state?.from?.pathName || "app";
    const formData = new FormData(event.currentTarget);
    const userName = formData.get("username");
    const { user, signIn, signOut } = authContext;
    signIn(userName, () => {
      navigate("app")
    });
  }

  return (
    <div className="public">
      <div className="info" style={{

        width: "500px",
        padding: "25px",
        boxShadow: "rgba(50, 50, 93, 0.25) 0px 50px 100px -20px, rgba(0, 0, 0, 0.3) 0px 30px 60px -30px"
      }}>
        
        {/* <h1>Cover your page.</h1>
        <p class="lead">Today, we live in a highly competitive global business community. Where it’s more difficult than ever to add, retain and grow revenue. Because customers are more demanding. And they want to interact how and when they choose. It’s an omnichannel world, and companies that can provide the best customer experiences will prevail.</p>
        <p class="lead">
          <a href="#" class="btn btn-lg btn-secondary fw-bold border-white bg-white">Learn more</a>
        </p> */}
      </div>
      <div className="login">
        <div className="sign-in">
          <img className="logo" src={logo} />
          {/* <h2>Sign In</h2> */}
          <form onSubmit={onSubmitHandler}>
            <input type="email" name="username" placeholder="Username" />
            <input type="password" name="password" placeholder="Password" />
            <a href="#">Forgot password?</a>
            <input type="submit" value="Sign In" />
          </form>
        </div>

      </div>
    </div>

  )
}