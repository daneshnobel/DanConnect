 const authApi =  {
 
     isAuthenticated : false,

     signIn : (callback) => {
        authApi.isAuthenticated = true;
       callback()

    },
     signOut : (callback) => {
        authApi.isAuthenticated = false;
       callback()

    }

}

export default authApi;