import React,{useState} from "react";

import  authApi  from "./authApi";
 export const AuthContext = React.createContext(null);

const AuthProvider = ({children}) =>{
    const [user,setUser] = useState(null);
    const signIn = (userName,callback) => {
       return authApi.signIn(() => {
        setUser(userName);
        setTimeout(callback,100)
       })
    }
    const signOut = (callback) => {
       return authApi.signOut(() => {
        setUser(null);
        setTimeout(callback,100)
       })
    }

    let value = {user,signIn,signOut}
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


export default AuthProvider;