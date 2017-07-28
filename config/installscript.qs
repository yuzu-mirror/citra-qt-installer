function Controller()
{
}

Controller.prototype.ComponentSelectionPageCallback = function()
{
    /*console.log("Kernel type: " + systemInfo.kernelType);
    
    var platform;
    
    if (systemInfo.kernelType === "winnt") { // Windows
        platform = "windows";
    } else if (systemInfo.kernelType === "darwin") { // Mac
        platform = "osx";
    } else if (systemInfo.kernelType === "linux") { // Linux
        platform = "linux";
    } else { // else, no installable components will appear
        platform = "unknown";
    }
    
    var components = installer.components();
    for (var i = 0; i < components.length; i++) {
        var component = components[i];
        var name = component.name
            .replace("msvc", "windows")
            .replace("mingw", "windows");
        if (name.indexOf(platform) === -1) {
            component.setValue("Virtual", "true");
            component.setValue("Default", "false");
        } else {
            component.setValue("Default", "true"); // This only applies to "script" tagged components
            component.setValue("Enabled", "true");
        }
    }*/
}
