function Component() {
    if (systemInfo.kernelType === "winnt") {
        component.setValue("Virtual", "false");
        component.setValue("Default", "true");
    } else {
        component.setValue("Virtual", "true");
        component.setValue("Enabled", "false");
    }
}

Component.prototype.createOperations = function()
{
    component.createOperations();

    component.addOperation("CreateShortcut", "@TargetDir@/nightly-mingw/citra-qt.exe", "@StartMenuDir@/Citra Nightly.lnk",
        "workingDirectory=@TargetDir@/nightly-mingw");
}
