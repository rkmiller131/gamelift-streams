// An IIFE to create a private scope for global variables that need to be shared across script files.
const globals = (() => {
  const privateData = {
    connectionToken: null,
    inputEnabled: true,
    gameLiftStreams: null,
    metricsUpdateInterval: null,
  };
  return {
      setData: (key, value) => privateData[key] = value,
      getData: (key) => privateData[key],
      getAllData: () => ({...privateData})
  };
})();