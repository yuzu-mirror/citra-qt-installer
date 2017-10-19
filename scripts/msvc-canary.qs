function Component() {
    if (systemInfo.kernelType === "winnt") {
        component.setValue("Virtual", "true"); // Hidden by default
        component.setValue("Default", "false"); // bleeding
        component.setValue("Enabled", "false");
    } else {
        component.setValue("Virtual", "true");
        component.setValue("Enabled", "false");
    }
}

Component.prototype.createOperations = function()
{
    component.createOperations();

    component.addOperation("CreateShortcut", "@TargetDir@/canary/citra-qt.exe", "@StartMenuDir@/Citra Canary.lnk",
        "workingDirectory=@TargetDir@/canary");
}
