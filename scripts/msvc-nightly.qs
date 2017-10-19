function Component() {
    if (systemInfo.kernelType === "winnt") {
        component.setValue("Virtual", "true"); // Hidden by default
        component.setValue("Default", "false"); // msvc
        component.setValue("Enabled", "false");
    } else {
        component.setValue("Virtual", "true");
        component.setValue("Enabled", "false");
    }
}

Component.prototype.createOperations = function()
{
    component.createOperations();

    component.addOperation("CreateShortcut", "@TargetDir@/nightly/citra-qt.exe", "@StartMenuDir@/Citra Nightly.lnk",
        "workingDirectory=@TargetDir@/nightly");
}
